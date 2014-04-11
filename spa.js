// Spa.js is a simple single page app micro-framework. Its purpose is to organize
// your code into a MVC-like pattern, allowing you to work with paths, controllers,
// actions and callbacks in javascript. It does not depend on other libraries and has
// been production tested for IE8+ browsers.

/*
 *             mm###########mmm
 *          m####################m
 *        m#####`"#m m###"""'######m
 *       ######*"  "   "   "mm#######
 *     m####"  ,             m"#######m    Spa.js Micro-Framework
 *    m#### m*" ,'  ;     ,   "########m   MIT License
 *    ####### m*   m  |#m  ;  m ########   Copyright (c) 2014 Dejan Strbac
 *   |######### mm#  |####  #m##########|  https://github.com/dejanstrbac/spa
 *    ###########|  |######m############
 *    "##########|  |##################"
 *     "#########  |## /##############"
 *       ########|  # |/ m###########
 *        "#######      ###########"
 *          """"""       """""""""
 */

// To run a new Spa app, embedd this script first. You are then ready to go by running
// `var spaApp = Spa();`. You can specify all app dependencies as arguments as you
// will see further in the code. Note that there can be only one spa app running at a time.
var Spa = Spa || function(options) {
  'use strict';
   var  SPA_VERSION = 3.22,

        initOptions = (typeof options === 'undefined') ? {} : options,

        // In the app routes, if there is no action defined, this one will be
        // assumed. This makes sense when there is a single action controller.
        DEFAULT_ACTION_NAME = 'handler',

        // Start by memoizing the container element, as we will often require it.
        containerElement = document.getElementById(initOptions.containerId) ||
                           document.createElement('DIV'),
        containerWrapElement,

        // Request and response objects are kept even after the request has been
        // completed so that context can be kept for the next request. Requests
        // form a linked list, making whole history avaialable within request.
        request,
        response,

        // Previous app state is saved given in the request to the controller as
        // aid for context determination. In most cases it is not needed or used,
        // but could be helpful for having a section of e.g. last seen pages.
        previousPath,

        // When hash listeners are not supported in older browsers, we will poll
        // for hash changes every `200` milliseconds.
        pollingInterval = initOptions.pollingInterval || 200,

        // The SPA app logic is contained in the following objects. Contents
        // are injected via public interfaces.
        routes      = initOptions.routes      || [],
        controllers = initOptions.controllers || {},
        callbacks   = initOptions.callbacks   || {},

        // Memo storages for aiding memoization in helpers, controllers, views...
        // We separate internal from the ones exposed in the public interface.
        internalObjectsMemo = {},
        publicObjectsMemo   = {},

        // SPA includes a basic template renderer, but it is recommended to
        // override it with something more powerful like Mustache templating.
        customTemplateEngine = initOptions.templateEngine,

        // There is quite a lot of stuff happening within SPA, although all
        // fairly simple. Having some logging in development mode might be helpful.
        debugging = initOptions.debug || false,

        // Indicator whether application is running or not, so we can prevent
        // multiple initializations.
        isRunning,

        // The $ is a utility object and keeps non SPA releted methods, for DOM,
        // object and events handling. It has been encapsulated on its own so it
        // mat be extracted.
        $ = function() {
              // Executing the specified method on each element of the array. Does
              // not modify the array on its own. Defined for more readable loops.
          var arrayEach = function(array, method) {
                for (var i = 0, l = array.length; i < l; i += 1) {
                  method(array[i], i);
                }
              },

              // Extend a function with another one, by wrapping into a new function,
              // which executes the new one and then the old one. If the new function
              // returns false, the chaining will be stopped, and older function will
              // not be executed.
              extendFunc = function(oldFunc, newFunc) {
                return function() {
                  var rValue = newFunc.apply(this, arguments);
                  if (rValue !== false) {
                    rValue = rValue || oldFunc.apply(this, arguments);
                  }
                  return rValue;
                };
              },

              // Non-destructive method overriding, used for extending callbacks, helpers
              // and controller objects. The methods are chained, the new one taking place
              // before the old one.
              extendMethods = function(oldMethods, newMethods) {
                for (var m in newMethods) {
                  if (newMethods.hasOwnProperty(m)) {
                    if (oldMethods.hasOwnProperty(m)) {
                      oldMethods[m] = extendFunc(oldMethods[m], newMethods[m]);
                    } else {
                      oldMethods[m] = newMethods[m];
                    }
                  }
                }
              },

              addEventListener = function (el, eventName, handler) {
                if (el.addEventListener) {
                  el.addEventListener(eventName, handler);
                } else {
                  el.attachEvent('on' + eventName, function(){ handler.call(el); });
                }
              },

              onDocumentReady = function (fn) {
                if (document.addEventListener) {
                  document.addEventListener('DOMContentLoaded', fn);
                } else {
                  document.attachEvent('onreadystatechange', function() {
                    if (document.readyState === 'interactive') { fn(); }
                  });
                }
              },

              // Not all browsers support the `onhashchange` event. We must check,
              // and if not supported fallback to the alternative solution of polling.
              // The following check is taken from Modernizr.js: documentMode logic
              // from YUI to filter out IE8 Compatibility Mode which gives false positives.
              hashChangeSupported = (function() {
                return ('onhashchange' in window) &&
                  (document.documentMode === undefined || document.documentMode > 7);
              })(),

              // Method to extract hash paths from the url. IE returns "#" when there
              // is nothing in front of the hash, while other browsers return null
              // in this situation.
              getLocationHash = function() {
                return (window.location.hash && (window.location.hash !== '#')) ? window.location.hash : '#!/';
              },

              // Simple dummy renderer. It can be redefined by calling
              // `setRenderer` which will override this method. If there is a problem,
              // it should return either `null` or `false`.
              interpolate = function(str, data) {
                for(var p in data) {
                  if (data.hasOwnProperty(p)) {
                    str = str.replace(new RegExp('{{'+p+'}}','g'), data[p]);
                  }
                }
                return str;
              },

              // Simple conditional internal logging method to analyze the flow
              // throughout the spa application.
              debugLog = function(msgTemplate, msgData) {
                if ((typeof console !== 'undefined') && console.log) {
                  console.log(interpolate(msgTemplate, msgData));
                }
              };

            // Public methods of $ utility object
            return {
              each                : arrayEach,
              extendMethods       : extendMethods,
              addEventListener    : addEventListener,
              onDocumentReady     : onDocumentReady,
              debugLog            : debugLog,
              hashChangeSupported : hashChangeSupported,
              getLocationHash     : getLocationHash,
              interpolate         : interpolate
            };
        }(),

        log = function(message) {
          if (debugging) {
            $.debugLog('Spa: {{debugMessage}}', { debugMessage: message});
          }
        },

        memoEngine = function(memoStorage) {
          var memoWrapper = function(bucket, key, getterFunc, useMemo, conditionalFunc) {
                var getterFuncResult;
                // Initialize the memoStorage if needed
                if (!memoStorage) { memoStorage = {}; }

                // If `useMemo` is not passed, we will still assume memoization.
                if (typeof useMemo === 'undefined') { useMemo = true; }

                if (useMemo) {
                  // If the given key is an Array, casting to string will join its
                  // elements (e.g.) `[1,2]` into `"1,2"` which is again sufficient.
                  key = key.toString();

                  // Buckets are canonical names used to separate namespaces for key/values.
                  bucket = bucket.toString();
                  if (!memoStorage.hasOwnProperty(bucket)) {
                    memoStorage[bucket] = {};
                  }

                  // Simply check if the memo key is defined on the bucket.
                  // Set it if it does not, otherwise just return it.
                  if (!memoStorage[bucket].hasOwnProperty(key)) {
                    log('memo miss: ' + bucket + '[' + key + ']');
                    if (getterFunc) {
                      // In case the passed getter is not calleable, just use its value.
                      if (typeof getterFunc === 'function') {
                        getterFuncResult = getterFunc(key);
                      } else {
                        getterFuncResult = getterFunc;
                      }
                      // If a `conditionalFunc` function is passed, the response from
                      // the `getterFunc` is passed through it to determine whether
                      // memoization should happen or not. The `conditionalFunc` should
                      // return a boolean value.
                      if ((typeof conditionalFunc === 'undefined') ||
                          (conditionalFunc && conditionalFunc(getterFuncResult))) {
                        log('memo write: ' + bucket + '[' + key + ']');
                        memoStorage[bucket][key] = getterFuncResult;
                      }
                      return getterFuncResult;
                    }
                  } else {
                    log('memo hit: ' + bucket + '[' + key + ']');
                    return memoStorage[bucket][key];
                  }
                } else {
                  // Memoization is being skipped. If there was an existing memorized
                  // value it should be invalidated/removed.
                  if (memoStorage.hasOwnProperty(bucket) &&
                        memoStorage[bucket].hasOwnProperty(key)) {
                    delete memoStorage[bucket][key];
                  }
                  // If `getterFunc` is `null`, the call is made just for deleting the
                  // memoized version, hence clearing the cache.
                  if (getterFunc) { return getterFunc(key); }
                }
              },

              memoExists = function (bucket, key) {
                return memoStorage.hasOwnProperty(bucket) &&
                         memoStorage[bucket].hasOwnProperty(key);
              };

          return {
            memoize: function(bucket, key, getterFunc, useMemo, conditionalFunc) {
              // SPA framework uses extensively memoization (caching) internally, as
              // in catalog-like web apps the likelyhood to browse back to a page is
              // very high. the same mechanisms are opened for app use, by making this
              // method public in the return object below.
              //
              // The `bucket` argument is used for namespace of keys and semantical
              // separation in the memory object. Mandatory along with `key`.
              //
              // The optional `getterFunc` argument can be exempt in case we just want
              // to extract an existing memoized value.
              //
              // The optional `useMemo` argument is a boolean value which defaults to
              // `true`, used to circumvent the memoization algorithm, and delete
              // previously memoized value.
              //
              // The optional argument `conditionalFunc` is a conditional function
              // which will accept the resulting value of the `getterFunc` as function
              // argument. If `conditionalFunc` is passed and it returns `true`
              // the returned `getterFunc` value will be memoized, otherwise the
              // memoization will be circumvented.
              return memoWrapper(bucket, key, getterFunc, useMemo, conditionalFunc);
            },

            isMemoized: function (bucket, key) {
              // Simple check whether an object is already memoized - present in the cache
              return memoExists(bucket, key);
            }
          };
        },

        // We need a simple way of redirecting, by default to SPA hash bang
        // paths, buy also possibly with a different url method. This can for
        // instance be used in the response from the controller, by returning
        // a redirect option (see below).
        redirectToPath = function(destinationHashPath, url) {
          if (typeof url === 'undefined') {
            log('redirected to: ' + destinationHashPath);
            window.location.hash = '#!' + destinationHashPath;
            // Previous path must be cleared otherwise router may not recognize
            // the change if the path is the same as the new one.
            previousPath = null;
          } else {
            window.location = url + (destinationHashPath || '');
          }
        },

        // Parsing of the the current location hash and splitting it in
        // REST-like parameters which are returned.
        getParams = function(str) {
          var qs     = str || window.location.hash,
              params = {},
              qsArray,
              pair;
          if (qs.match(/^\#\!/)) {
            qsArray = qs.substr(3).split('/');
            while (qsArray.length !== 0) {
              pair = qsArray.splice(0, 2);
              params[pair[0]] = pair[1];
            }
          }
          return params;
        },

        // Finding out the current route based on the information passed into
        // the hash, and returning the route entry with all its content back.
        // SPA routes start with `#!` - (hash bang).
        getRouteFor = function(path) {
          var currentRoute, i, l;
          // We will first try matching the `root route`, as with highest priority.
          if (path.match(/^$|^#(?!\!).+/)) {
            currentRoute = routes.slice(-1)[0];
          } else if (path.match(/^\#\!.+/)) {
            for (i=0, l=routes.length; (i < l) && !currentRoute; i+=1) {
              if (new RegExp(routes[i].url).test(path.slice(2))) {
                currentRoute = routes[i];
              }
            }
          }
          return currentRoute;
        },

        // Based on the passed request, respective controller action is called
        // and its contents get memoized. A conditional function is passed to
        // determine whether the response should be memoized or not.
        getControllerActionResponseFor = function(request) {
          return $cache.memoize('spa__responses', request.path, function() {
            return (controllers[request.controller][request.action])(request);
          }, true, function(response) {
            // The conditional memoization function allows the response to determine
            // on its own whether it will be memoized or not.
            return response && response.hasOwnProperty('options') && !!response.options.cache;
          });
        },

        // There are callbacks defined in multiple places in the router,
        // such as `beforeRender`, `afterRender` etc. The logic is the same,
        // so this method has been extracted out and generalized. There are
        // two levels of callbacks, one on the app level, which will run for
        // every controller, and there are callbacks on the controller level.
        //
        // Controller callbacks have higher priority than the app ones as they
        // carry more relevant logic.
        //
        // Note that response may be ommited in some cases such as `beforeFilter`.
        runCallbacks = function(callbackName, request, response) {
          var controllerCallback = controllers[request.controller][callbackName],
              globalCallback     = callbacks[callbackName];
          if (controllerCallback) {
            log('callback: ' + request.controller + '.' + callbackName + '()');
            setTimeout(function(){ controllerCallback.call(null, request, response); }, 5);
          }
          if (callbacks[callbackName]) {
            log('callback: ' + callbackName + '()');
            setTimeout(function(){ globalCallback.call(null, request, response); }, 5);
          }
        },

        // Based on request and response, this method will determine which
        // is the right template to render. It returns template name.
        getTemplateNameFor = function(request, response) {
          // Assume the controller name for the template and using single action
          // controllers called `handler` as defined in `DEFAULT_ACTION_NAME`.
          var templateName = request.controller;
          // The controller can pass a name of the template to render
          // in the options part of the response. Otherwise it can be
          // assumed by the action name.
          if (response.options && response.options.hasOwnProperty('templateName')) {
            templateName = response.options.templateName;
          } else if (request.action) {
            // If action is passed, we will assume that action name
            // as template definition.
            templateName += '__' + request.action;
          }
          return templateName;
        },

        getRemoteTemplate = function (templateName, successHandler) {
          var request = new XMLHttpRequest();
          log('remote template requested: ' + templateName + '.spa.html');
          request.open('GET', templateName + '.spa.html', true);
          request.onreadystatechange = function() {
            if (this.readyState === 4){
              if (this.status >= 200 && this.status < 400) {
                if (typeof successHandler !== 'undefined') {
                  successHandler(templateName, this.responseText);
                  log('remote template retrieved: ' + templateName + '.spa.html');
                }
              } else {
                throw new Error('remote template not found >> ' + templateName);
              }
            }
          };
          request.send();
          request = null;
        },

        compileTemplate = function(template, data) {
          var compiledTemplate;
          if (customTemplateEngine) {
            compiledTemplate = customTemplateEngine(template, data);
          } else {
            compiledTemplate = $.interpolate(template, data);
          }
          if (!compiledTemplate) { throw new Error('template error >> ' + response.options.template); }
          return compiledTemplate;
        },

        replaceContainerContents = function(newContents) {
          if (containerWrapElement) {
            containerElement.removeChild(containerWrapElement);
          }
          containerWrapElement = document.createElement('DIV');
          containerWrapElement.innerHTML = newContents;
          containerElement.appendChild(containerWrapElement);
        },

        // Rendering, wrapping and setting of the template into the defined
        // application container. Wrapping is done so that the effort of
        // insertion as well deletion is minimal on the DOM. At the same time,
        // removal is done before setting so that the possible events are
        // cleared, hopefully preventing memory leaks.
        renderResponse = function(response) {
          var template = $cache.memoize('spa__templates', response.options.template),
              renderedView,
              cacheKey;
          response.data    = response.data    || {};
          response.options = response.options || {};
          // The cache key is the template name for nonmutating views, where the
          // attribute cache is just set to boolean true. To cache same views but for
          // different data, the attribute cache needs to be set to some data
          // that will uniquely identify it - e.g. id of a product.
          if (!template) {
            throw new Error('template not found >> ' + response.options.template);
          }
          if (response.options.cache) {
            cacheKey = response.options.template;
            if (response.options.cache !== true) {
              cacheKey += '-' + response.options.cache;
            }
            renderedView = $cache.memoize('spa__views', cacheKey, function() {
              return compileTemplate(template, response.data);
            });
          } else {
            renderedView = compileTemplate(template, response.data);
          }
          replaceContainerContents(renderedView);
        },

        // The router is invoked on every hash change. The route is parsed and
        // compared to predefined routes. Matching controller/action is then
        // called and passed parameters found in the hash.
        router = function() {
          var currentPath    = $.getLocationHash(),
              pollingAllowed = true,
              matchedRouteEntry;

          if (pollingAllowed && (currentPath !== previousPath)) {
            // In case of older browsers (IE6/7), where we use hash polling instead
            // of hash change events, polling needs to be terminated when we are
            // still on the same page, so unneccessary continous calls to the same
            // controller/action & re-renderring is avoided.
            pollingAllowed = false;
            matchedRouteEntry = getRouteFor(currentPath);
            if (!matchedRouteEntry) {
              // The route has not been recognized and we need to simulate a
              // 404 response. The 404 template can be defined just as any other.
              renderResponse({ options : { template: '404', cache: true } });
            } else {
              log('---');
              // Callback beforeUnload runs before a change of page is made. This
              // is a useful callback in case where events attached in afterRender callback
              // need to be detached from the DOM elements, before they get destroyed.
              // Obviously, this callback will not run on the inital loading of the app.
              if (request) {
                runCallbacks('beforeUnload', request, response);
              }

              // The request object is a linked list with all previous requests. Each node
              // contains the path, path-derived parameters and controller/action information.
              request = {
                path       : currentPath,
                params     : getParams(currentPath),
                controller : matchedRouteEntry.controller,
                action     : matchedRouteEntry.action || DEFAULT_ACTION_NAME,
                previous   : request
              };

              // Run the `beforeFilter` callbacks defined in controller and on top
              // level. Note that the response doesn't exist yet so it is not passed here.
              runCallbacks('beforeFilter', request);
              // Fetch the response by calling the respective route's defined
              // controller and action and passing the request object formed before.
              response = getControllerActionResponseFor(request);
              // The `afterFilter` callback might be useful, if we are not concerned
              // whether the controller action responded at all, but still need
              // to do after controller processing.
              runCallbacks('afterFilter', request, response);

              // If the controller action responed to hash parameters with data,
              // we can proceed to callbacks and rendering.
              if (response) {
                response.options = response.options || {};

                // Some controller actions have no need of a rendered response.
                // Those can be popups for instance, triggered by hash changes.
                if (response.options.renderNothing) {
                  log('template bypassed');
                } else {
                  // The `beforeRender` callback might be useful for cleaning up the
                  // previous view or detaching some events.
                  runCallbacks('beforeRender', request, response);

                  // Response object should give information which template was used.
                  response.options.template = getTemplateNameFor(request, response);

                  if (response.options.remoteTemplate &&
                      !$cache.isMemoized('spa__templates', response.options.templateName)) {
                    getRemoteTemplate(response.options.templateName, function(templateName, data) {
                      $cache.memoize('spa__templates', templateName, data);
                      // Remotely fetched template is memoized and only on success can be rendered.
                      // The data and options given from the action are passed into. The rendered
                      // template replaces current contents of the app container with the success
                      // callback, not before.
                      renderResponse(response);
                      // The `afterRender` callback runs also with the success callback of the remotely
                      // fetched template. It is usually the place where DOM events should be attached
                      // to the newly rendered html.
                      runCallbacks('afterRender', request, response);
                    });
                  } else {
                    // Finally the template is rendered and the data and options given
                    // from the action are passed into. The rendered template immediately
                    // replaces current contents of the app container.
                    renderResponse(response);
                    // The `afterRender` callback is usually the place where DOM events
                    // should be attached to the newly rendered html.
                    runCallbacks('afterRender', request, response);
                  }

                  // We must ensure we are scrolling to the page top,
                  // to simulate a well known page load behaviour
                  setTimeout(function(){ window.scrollTo(0, 0); }, 0);
                }

                // The response returned can ask for the app to redirect the page,
                // most likely to another SPA hash bang path, but also to another url
                // via the returned `redirectTo` property.
                //
                // Since this executes late, after rendering, it can be combined
                // with the `renderNothing` option to avoid any rendering before redirecting.
                if (response.options.redirectTo) {
                  redirectToPath(response.options.redirectTo);
                }
              } else {
                // The route has been recognized, but the controller returned an
                // empty response probably the object does not exist in the
                // payload (like wrong id).
                renderResponse({ options : { template: '404', cache: true } });
              }

              // Previous hash and exploded params out of it are kept
              // so they can be given in the next request's hash, as a
              // context aid.
              previousPath   = currentPath;

              // The handler of the route is finishing and polling is allowed
              // again - influences only older browsers.
              pollingAllowed = true;
            }
          }
        },

        // Initialize the internal memoizing engine.
        $cache = memoEngine(internalObjectsMemo),

        // Initialize and start the application. Obviously, since we here query
        // the DOM, it should have been loaded first. This method should only be
        // run through the Spa public interface.
        runApplication = function () {
          var templateElements = document.querySelectorAll("script[type='text/html']");
          if (!isRunning) {
            // Ensure there is a container of jQuery object / DOM element
            // to work with as a SPA. The rendering of pages will happen there.
            if (!containerElement) {
              throw new Error('container does not exist');
            }
            document.body.appendChild(containerElement);

            // Views templates are fetched at initialization time and memoized as
            // they will be often called, so no repetitive DOM access is needed.
            $.each(templateElements, function(templateEl) {
              var templateName = templateEl.id;
              if (templateName.substr(0,5) === 'spa__') {
                templateName = templateName.substring(5);
                $cache.memoize('spa__templates', templateName, function() {
                  return templateEl.innerHTML;
                });
              }
            });

            isRunning = true;

            // Starts the SPA app router, not forgetting to process the current
            // hash path, so the SPA app jumps to the desired state - as in the
            // case of copy/pasting a whole url.
            router();
            if ($.hashChangeSupported) {
              $.addEventListener(window, 'hashchange', router);
            } else {
              setInterval(router, pollingInterval);
            }
          }
        };

    // Expose public interfaces to the SPA object, so controllers/actions
    // and routes can be injected.
    return {
      // The helpers object exposes some of the internals which might be found
      // useful in the application, like templates, redirects and memoization.
      // It is recommended to extend this object with own methods via
      // the `addHelpers` defined below, so everything related to this SPA app
      // is kept in one object and place.
      helpers: {
        // If we need to use the template which was collected by SPA, its
        // contents can be retrieved with this method.
        getTemplate: function(templateName) {
          return $cache.memoize('spa__templates', templateName);
        },

        // Simple redirecting method, supporting both urls and hash bang paths,
        // used internally for redirecting within controllers' response.
        redirectTo: function(destinationHashPath, url) {
          return redirectToPath(destinationHashPath, url);
        },

        // The renderer can be called directly if needed for manual partials
        // renderings. The renderer will be either the default one (built-in),
        // or the one set through the `setRenderer` method below.
        render: function(template, data) {
          return compileTemplate(template, data);
        },

        // Initialize the public caching mechanism.
        cache: memoEngine(publicObjectsMemo)
      },

      // This method will selectively turn debug logging on or off at runtime.
      setDebug: function(value) {
        if (value !== 'undefined') { debugging = value; }
        log('SPA (Single Page App) v' + SPA_VERSION);
        log('https://github.com/dejanstrbac/spa');
        log('~~~~ ~~~ ~~~ ~~~ ~~~ ~~~~ ~~~~ ~~~');
        log('Debug mode enabled');
      },

      // If the default renderer (templating engine) won't do, a new one
      // can be set via this method. The signiture is function(template, data),
      // where template is a `text/html` file and data is of JSON format.
      setTemplateEngine: function(newEngine) {
        customTemplateEngine = newEngine;
      },

      // With this method we can extend in bulk the helpers object below.
      // Adding single methods is also easy by directly defining them on
      // the `spaApp.helpers`.
      addHelpers: function(newHelpers) {
        $.extendMethods(this.helpers, newHelpers);
      },

      // Controllers hold the main app logic/actions and are injected here,
      // by extending the private object `controllers`. The argument
      // `newControllers` is expected to be an object whose properties are
      // controllers of own properties which are actions.
      //
      // Properties with the following names `beforeRender`, `afterRender`,
      // `beforeFilter` & `afterFilter` define controller callbacks. To selectively
      // execute code in the callback for specific action, you can switch over
      // the property `action` of the request argument, containing the name
      // of the routed controller action.
      //
      // Successive calls to this method will extend already degined methods.
      addControllers: function(newControllers) {
        for (var c in newControllers) {
          if (newControllers.hasOwnProperty(c)) {
            controllers[c] = controllers[c] || {};
            $.extendMethods(controllers[c], newControllers[c]);
          }
        }
      },

      // Callbacks are methods which need to run after specific events in the code.
      // While controllers can defined own callback which are of higher priority,
      // here app level callbacks can be attached.
      //
      // The argument `newCallback` is  expected to be an object whose properties are
      // callbacks with possible names `beforeRender`, `afterRender`, `beforeFilter`
      // & `afterFilter` define callbacks. To selectively execute a callback for
      // specific action, we can switch over the name of the action present in
      // the request argument passed to the callback. All callbacks accept two arguments
      // `request` and `response`, except `beforeFilter` which accepts only `request`
      // as it executes before the controller action.
      //
      // Mutliple calls to this method for same callbacks are extending those callbacks
      // instead of overwriting them.
      addCallbacks: function(newCallbacks) {
        $.extendMethods(callbacks, newCallbacks);
      },

      // Routes map url hash bang paths to controllers and their respective
      // actions. First added routes have higher priority as they are matched
      // via regular expressions. The argument `newRoutes` is expected to be an
      // array of object paths.
      //
      // If action property is ommited above, the app will assume it's called `handler`
      // (from `DEFAULT_ACTION_NAME`). You can define as many routes as needed.
      addRoutes: function(newRoutes) {
        routes = routes.concat(newRoutes);
        return routes;
      },

      // Public interface to actually run the app. Run in this method as the last
      // one, to start the app.
      start: function() {
        $.onDocumentReady(runApplication);
        return isRunning;
      }
  };

};
