/*
 *             mm###########mmm
 *          m####################m
 *        m#####`"#m m###"""'######m
 *       ######*"  "   "   "mm#######
 *     m####"  ,             m"#######m       SPA (Single Page App) for jQuery/Zepto
 *    m#### m*" ,'  ;     ,   "########m
 *    ####### m*   m  |#m  ;  m ########      https://github.com/dejanstrbac/spa
 *   |######### mm#  |####  #m##########|
 *    ###########|  |######m############
 *    "##########|  |##################"
 *     "#########  |## /##############"
 *       ########|  # |/ m###########
 *        "#######      ###########"
 *          """"""       """""""""
 *
 *  Copyright (c) 2012, Dejan Strbac
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions are met:
 *
 *  1. Redistributions of source code must retain the above copyright notice, this
 *     list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright notice,
 *     this list of conditions and the following disclaimer in the documentation
 *     and/or other materials provided with the distribution.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 *  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 *  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 *  ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 *  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 *  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 *  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

;(function(window, document, $) {
  $.fn.spa = $.fn.spa || function() {

   var  SPA_VERSION = 2.11,

        // Not all browsers support the `onhashchange` event. We must check,
        // and if not supported fallback to the alternative solution of polling.
        // The following check is taken from Modernizr.js: documentMode logic
        // from YUI to filter out IE8 Compatibility Mode which gives false positives.
        hashChangeSupported = (function() {
          return ('onhashchange' in window) &&
                 (document.documentMode === undefined || document.documentMode > 7);
        })(),


        // In the app routes, if there is no action defined, this one will be
        // assumed. This makes sense when there is a single action controller.
        DEFAULT_ACTION_NAME = 'handler',


        // The limit of images to preload per render. Not all images are relevant
        // considering that the visitor sees only a part of the page once it's
        // rendered. This parameter can be defined per controller, in the
        // `options.preloadImages` property.
        PRELOAD_IMAGES_LIMIT = 30,


        // Preloading is based on a stack (LIFO) structure. The most relevant,
        // newest paths are pushed onto the stack, and taken to be preloaded on
        // interval basis.
        //
        // The delay for poping and preloading items from stack has a default
        // value, but it can be altered per controller by defining the property
        // `options.preloadStackDelay`. The limitation is that if different
        // controllers have different delays set, the new delay will not take
        // effect until the stack is emptied.
        //
        // The preload stack is of limited size, so browsing around would not
        // create too many preloading requests of low relevance.
        preloadStack            = [],
        preloadingIntervalId    = null,


        // The defaulting values for the preload stack should suffice in most cases.
        PRELOAD_STACK_POP_DELAY = 700,
        PRELOAD_STACK_MAX_SIZE  = 20,


        // Start by memoizing the container element. By attaching to the container,
        // multiple containers & SPA apps should be theoretically supported, while
        // they would have to share URL namespace and routes.
        containerElement = this,


        // Previous app state is saved given in the request to the controller as
        // aid for context determination. In most cases it is not needed or used,
        // but could be helpful for having a section of e.g. last seen pages.
        previousPath   = null,
        previousParams = null,


        // When hash listeners are not supported in older browsers, we will poll
        // for hash changes every `333` milliseconds.
        pollingInterval = 333,


        // The SPA app logic is contained in the following objects. Contents
        // are injected via public interfaces.
        routes      = [],
        controllers = {},
        callbacks   = {},


        // SPA includes a basic template renderer, but it is recommended to
        // overrided it with something more powerful like Mustache engine.
        customRenderer = null,


        // Helper memo for aiding memoization in helpers and controllers,
        // so extraction from payload is optimized.
        objectsMemo = {},


        // There is quite a lot of stuff happening within SPA, although all
        // fairly simple. Having some logging in development mode might be helpful.
        debugging = false,


        // A simple indicator whether application is running or not.
        running = false,


        // Method to extract hash paths from the url. IE returns "#" when there
        // is nothing in front of the hash, while other browsers return null
        // in this situation.
        getHash = function() {
          if (window.location.hash && (window.location.hash !== '#')) {
            return window.location.hash;
          } else {
            return '#!/';
          }
        },


        // Non-destructive method overriding, used for extending callbacks, helpers
        // and controller objects. The methods are chained, the new one taking place
        // before the old one.
        extendMethods = function(oldMethods, newMethods) {
          var extender = function(om, nm) {
                return function() {
                  var nv = nm.apply(this, arguments),
                      ov = om.apply(this, arguments);
                  return nv || ov;
                };
              },
              m = null;

          for (m in newMethods) {
            if (newMethods.hasOwnProperty(m)) {
              if (oldMethods.hasOwnProperty(m)) {
                oldMethods[m] = extender(oldMethods[m], newMethods[m]);
              } else {
                oldMethods[m] = newMethods[m];
              }
            }
          }
        },


        // Simple conditional internal logging method to analyze the flow
        // throughout the spa application.
        spaLog = function(msg) {
          if (debugging && (typeof console !== "undefined") && console.log) {
            console.log('(spa) ' + msg);
          }
        },


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
        memoize = function(bucket, key, getterFunc, useMemo, conditionalFunc) {
          var getterFuncResult = null;

          // If `useMemo` is not passed, we will still assume memoization.
          if (typeof useMemo === 'undefined') {
            useMemo = true;
          }

          if (useMemo) {
            // If the given key is an Array, casting to string will join its
            // elements (e.g.) `[1,2]` into `"1,2"` which is again sufficient.
            key = key.toString();

            // Buckets are canonical names used to separate namespaces for key/values.
            bucket = bucket.toString();
            if (!objectsMemo.hasOwnProperty(bucket)) {
              objectsMemo[bucket] = {};
            }

            // Simply check if the memo key is defined on the bucket.
            // Set it if it does not, otherwise just return it.
            if (!objectsMemo[bucket].hasOwnProperty(key)) {
              spaLog('mem miss: ' + bucket + '[' + key + ']');
              if (getterFunc) {
                getterFuncResult = getterFunc(key);
                // If a `conditionalFunc` function is passed, the response from
                // the `getterFunc` is passed through it to determine whether
                // memoization should happen or not. The `conditionalFunc` should
                // return a boolean value.
                if ((typeof conditionalFunc === 'undefined') ||
                    (conditionalFunc && conditionalFunc(getterFuncResult))) {
                  objectsMemo[bucket][key] = getterFuncResult;
                }
                return getterFuncResult;
              }
            } else {
              spaLog('mem hit: ' + bucket + '[' + key + ']');
              return objectsMemo[bucket][key];
            }
          } else {
            // Memoization is being skipped. If there was an existing memorized
            // value it should be invalidated/removed.
            if (objectsMemo.hasOwnProperty(bucket) &&
                objectsMemo[bucket].hasOwnProperty(key)) {
              delete objectsMemo[bucket][key];
            }
            // If `getterFunc` is `null`, the call is made just for deleting the
            // memoized version, hence clearing the cache.
            if (getterFunc) {
              return getterFunc(key);
            }
          }
        },


        // SPA includes own simple dummy renderer. It can be redefined by calling
        // `setRenderer` which will override this method. If there is a problem,
        // it should return either `null` or `false`.
        templateRenderer = function(template, data) {
          if (customRenderer) {
            return customRenderer.call(this, template, data);
          } else {
            var p;
            for(p in data) {
              if (data.hasOwnProperty(p)) {
                template = template.replace(new RegExp('{{'+p+'}}','g'), data[p]);
              }
            }
            return template;
          }
        },


        // We need a simple way of redirecting, by default to SPA hash bang
        // paths, buy also possibly with a different url method. This can for
        // instance be used in the response from the controller, by returning
        // a redirect option (see below).
        redirectToPath = function(destinationHashPath, url) {
          if (typeof url === 'undefined') {
            spaLog('redirecting page: ' + destinationHashPath);
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
          var qs      = str || window.location.hash,
              params  = {},
              qsArray = null,
              pair    = null;
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
          var currentRoute = null, i, l;
          // We will first try matching the `root route`, as with highest priority.
          if (path.match(/^$|^#(?!\!).+/)) {
            currentRoute = routes.slice(-1)[0];
          } else if (path.match(/^\#\!.+/)) {
            for (i=0, l=routes.length; (i < l) && !currentRoute; i+=1) {
              if (RegExp(routes[i].url).test(path.slice(2))) {
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
          return memoize('spa__responses', request.path, function() {
            return (controllers[request.controller][request.action])(request);
          }, true, function(response) {
            // Conditional memoization function, will return true if property
            // `options.cache` is not `undefined`, `0`, `null`, or `''`.
            return response &&
                     response.hasOwnProperty('options') && !!response.options.cache;
          });
        },


        // There are callbacks defined in multiple places in the router,
        // such as `beforeRender`, `afterRender` etc. The logic is the same,
        // so this method has been extracted out and generalized. There are
        // two levels of callbacks, one on the app level, which will run for
        // every controller, and there are callbacks on the controller level.
        //
        // Controller callbacks have higher priority than the app ones as they
        // are closer to the logic code.
        //
        // Note that response may be ommited in some cases such as `beforeFilter`.
        runCallbacks = function(callbackName, request, response) {
          if (controllers[request.controller][callbackName]) {
            controllers[request.controller][callbackName].call(this, request, response);
            spaLog('callback ' + request.controller + '.' + callbackName + '()');
          }
          if (callbacks[callbackName]) {
            callbacks[callbackName].call(this, request, response);
            spaLog('callback ' + callbackName + '()');
          }
        },


        // Based on request and response, this method will determine which
        // is the right template to render. It returns template name.
        getTemplateNameFor = function(request, response) {
          // Assume the controller name for the template and using single action
          // controllers called `handler` as defined in `DEFAULT_ACTION_NAME`.
          var templateToRender = request.controller;

          // The controller can pass a name of the template to render
          // in the options part of the response. Otherwise it can be
          // assumed by the action name.
          if (response.options && response.options.template) {
            templateToRender = response.options.template;
          } else if (request.action) {
            // If action is passed, we will assume that action name
            // as template definition.
            templateToRender += '__' + request.action;
          }
          return templateToRender;
        },


        // Rendering, wrapping and setting of the template into the defined
        // application container. Wrapping is done so that the effort of
        // insertion as well deletion is minimal on the DOM. At the same time,
        // removal is done before setting so that the possible events are
        // cleared, hopefully preventing memory leaks.
        renderTemplate = function(response) {
          var template     = memoize('spa__templates', response.options.template),
              renderedView = null,
              cacheKey     = null;

          response.data    = response.data    || {};
          response.options = response.options || {};

          // The cache key is the template name for nonmutating views, where the
          // attribute cache is just set to true. To cache same views but for
          // different data, the attribute cache needs to be set to some data
          // that will uniquely identify it - e.g. id of a product.
          if (response.options.cache) {
            if (response.options.cache === true) {
              cacheKey = response.options.template;
            } else {
              cacheKey = response.options.template + '-' + response.options.cache;
            }
          }

          // Using the same memoization mechanism defined above, we will
          // cache the views that allow it, so they do not need to be re-rendered.
          // if the `cacheKey` is `null` the wrapped memoization method will be
          // circumvented and the getter function will be executed.
          renderedView = memoize('spa__views', cacheKey, function() {
            var tmpView = null;
            if (template) {
              tmpView = templateRenderer(template, response.data);
              if (tmpView) {
                return '<div id="spa__wrap">' + tmpView + '</div>';
              } else {
                throw new Error('template error >> ' + response.options.template);
              }
            } else {
              throw new Error('template not found >> ' + response.options.template);
            }
          }, (cacheKey !== null));

          return renderedView;
        },


        // Images of preloaded paths can also be preloaded before
        // being shown. Since the visitor has a limited view into the
        // page, a `numberOfImages` argument can be passed to indicate
        // an estimate of how many images are shown in the initial viewport,
        // so bandwidth is preserved. If no parameter is passed,
        // `PRELOAD_IMAGES_LIMIT` is assumed.
        preloadViewImages = function(htmlText, numberOfImages) {
          // A bit of monkey business here. All images are replaced with
          // BR elements so external resources are not automatically loaded
          // when jQuery attaches the html text to the DOM tree for parsing.
          //
          // If image had own class tag, it would be ignored as new class is
          // injected as first definition. The modified template is only for
          // image extraction purposes and is not saved or displayed.
          htmlText = htmlText.replace(/<[iI][mM][gG]/g, '<br class="spa-image-preloading"');

          if (!$.isNumeric(numberOfImages)) {
            numberOfImages = PRELOAD_IMAGES_LIMIT;
          }

          $.each(
            $(htmlText).find('br.spa-image-preloading').slice(0, numberOfImages),
              function() {
                var srcPath = $(this).attr('src');
                $('<img/>')[0].src = srcPath;
                spaLog('preload image: ' + srcPath);
              }
          );
        },


        // SPA has ability to preload a path by calling the controller
        // action in the background and rendering its returned template for
        // memoization purposes. Once in memory, subsequent renderings of possible
        // next paths would only call callbacks, making the response time even
        // shorter.
        preloadPath = function(destinationPath) {
          var preloadRoute = getRouteFor(destinationPath),
              currentPath  = getHash(),
              request      = null,
              renderedView = null;

          if (preloadRoute) {
            request = {
              path           : destinationPath,
              previousPath   : currentPath,
              params         : getParams(destinationPath),
              previousParams : getParams(currentPath),
              controller     : preloadRoute.controller,
              action         : preloadRoute.action || DEFAULT_ACTION_NAME
            };

            // A call to the controller is being made assuming it will memoize
            // the response for possible future request.
            response = getControllerActionResponseFor(request);

            // Preloading does not return anything nor does it render any templates
            // into the container. Renderer is being called only to memoize the
            // response which is here used only to further preloading.
            if (!response.options.renderNothing) {

              response.options.template = getTemplateNameFor(request, response);
              renderedView = renderTemplate(response);

              // Since images take most time to load, they can be preloaded along
              // with the rendered template. If property `options.preloadImages` is
              // set to `true`, the `PRELOAD_IMAGES_LIMIT` will be assumed as number
              // of images to load. Otherwise, if the property is numeric, that number
              // will be used as a limit of images to preload for the controller
              // action being preloaded.
              if (response.options.preloadImages) {
                preloadViewImages(renderedView, response.options.preloadImages);
              }

            }
            spaLog('preload path done: ' + destinationPath);
          }
        },


        // This method will determine all unique paths which look are SPA-like
        // in the passed container element, starting with a hash bang and their
        // respective anchors not having class `.spa-no-preload`. The paths will
        // be pushed onto the preload stack from where they will be preloaded one
        // by one in non-blocking intervals.
        //
        // This method will return all preloaded paths in case they are
        // needed in the controller or further callbacks.
        preloadContainerPaths = function(container) {
          var containerPaths = [];
          container.find('a').each(function() {
            var nextPath = $(this).attr('href');
            if (nextPath && (!$(this).hasClass('.spa-no-preload')) &&
                 (nextPath.lastIndexOf('#!/', 0) === 0) &&
                   ($.inArray(nextPath, containerPaths) === -1)) {

              preloadStack.push(nextPath);

              // If the maximum size of the preload stack is exceeded, the
              // stack will drop the oldest paths in it to make space for the new
              // more relevant ones.
              if (preloadStack.length > PRELOAD_STACK_MAX_SIZE) {
                preloadStack.shift();
              }

              containerPaths.push(nextPath);
            }
          });
          return containerPaths;
        },


        // Javascript applications are executed as a single process. Preloading
        // the whole content at once would make the app irresponsive. Therefore
        // we make use of the LIFO preloading stack. It gets activated via
        // controller response that requests preloading, and it works until it
        // gets emptied. Items are popped from the stack in intervals, with a
        // delay that can also be set in the options property of the controller
        // response or defaults to `PRELOAD_STACK_POP_DELAY`.
        emptyPreloadStack = function (request, response) {
          var nextPath = null;
          if (preloadStack.length) {
            nextPath = preloadStack.pop();
            if (nextPath) {
              spaLog('\n ~~~ \npreload stack pop (' + preloadStack.length + '): ' + nextPath);
              preloadPath(nextPath);
            }
          } else {
            // The preload stack has been emptied and the interval needs to be
            // cancelled and cleared, so further preload responses can activate
            // it again.
            spaLog('preload stack empty');
            clearInterval(preloadingIntervalId);
            preloadingIntervalId = null;

            // When preloading is done, the `afterPreload` callback is called,
            // for possible application hooks e.g. loading completed.
            runCallbacks('afterPreload', request, response);
          }
        },


        // The router is invoked on every hash change. The route is parsed and
        // compared to predefined routes. Matching controller/action is then
        // called and passed parameters found in the hash.
        router = function() {
          var currentPath       = getHash(),
              pollingAllowed    = true,
              matchedRouteEntry = null,
              request           = null,
              response          = null;

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
              containerElement.empty().html(
                renderTemplate({ options : { template: '404', cache: true } }));
            } else {
              request = {
                path           : currentPath,
                previousPath   : previousPath,
                params         : getParams(currentPath),
                previousParams : previousParams,
                controller     : matchedRouteEntry.controller,
                action         : matchedRouteEntry.action || DEFAULT_ACTION_NAME
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

                // Some controller actions have no need of a rendered response.
                // Those can be popups for instance, triggered by hash changes.
                if (response.options.renderNothing) {
                  spaLog('template bypassed');
                } else {
                  // The `beforeRender` callback might be useful for cleaning up the
                  // previous view or detaching some events.
                  runCallbacks('beforeRender', request, response);

                  // Response object should give information which template was used.
                  response.options.template = getTemplateNameFor(request, response);

                  // Finally the template is rendered and the data and options given
                  // from the action are passed into. The rendered template immediately
                  // replaces current contents of the app container.
                  containerElement.empty().html(renderTemplate(response));

                  // The `afterRender` callback is usually the place where DOM events
                  // should be attached to the newly rendered html.
                  runCallbacks('afterRender', request, response);

                  // If the `preloadPaths` property is specified in the controller response,
                  // we will preload all paths in the rendered container, by memoizing the
                  // controller responses as well the rendered templates - but without callbacks.
                  //
                  // The list of all preloaded paths is attached to the response, for
                  // possible later use in the application via e.g. callback.
                  //
                  // Paths that trigger preloading of own links are memoized so thay are not
                  // unnecessarily preloaded twice, as web pages normally repeat same links
                  // across pages.
                  if (response.options.preloadPaths) {
                    response.preloadedPaths = memoize('spa__preloaded_paths', request.path,
                      function() {
                        var responsePaths = preloadContainerPaths(containerElement);
                        if (!preloadingIntervalId) {
                          preloadingIntervalId = setInterval(
                            function() { emptyPreloadStack(request, response); },
                            response.options.preloadStackDelay || PRELOAD_STACK_POP_DELAY);
                        }
                        return responsePaths;
                      });
                  }

                  // We must ensure we are scrolling to the page top,
                  // to simulate a well known page load behaviour
                  window.scrollTo(0, 0);
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
                containerElement.empty().html(
                  renderTemplate({ options : { template: '404', cache: true } })
                );
              }

              // Previous hash and exploded params out of it are kept
              // so they can be given in the next request's hash, as a
              // context aid.
              previousParams = request.params;
              previousPath   = currentPath;

              // The handler of the route is finishing and polling is allowed
              // again - influences only older browsers.
              pollingAllowed = true;
            }
          }
        },


        // Starts the SPA app router, not forgetting to process the current
        // hash path, so the SPA app jumps to the desired state - as in the
        // case of copy/pasting a whole url.
        startRouter = function() {
          if (!running) {
            running = true;
            if (hashChangeSupported) {
              $(window).on('hashchange', router);
            } else {
              setInterval(router, pollingInterval);
            }
            router();
            return running;
          } else {
            // SPA is already running.
            return false;
          }
        };


    // Ensure there is a container of jQuery object / DOM element
    // to work with as a SPA. The rendering of pages will happen there.
    if (!containerElement.length) {
      throw new Error('container does not exist');
    }

    // Views templates are fetched at initialization time and memoized as
    // they will be often called, so no repetitive DOM access is needed.
    $("script[type='text/html']").map(function(i, el) {
      var templateEl   = $(el),
          templateName = templateEl.attr('id');

      if (templateName.substr(0,5) === 'spa__') {

        templateName = templateName.substring(5);
        memoize('spa__templates', templateName, function() {
          return templateEl.html();
        });
      }
    });


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
          return memoize('spa__templates', templateName);
        },

        // Memoization is quite useful in SPA, and even though most of the responses
        // and views are memoized, the mechanism can be useful for use in the custom
        // controller actions and helpers.
        //
        // The signiture of this method is the same as the one defined at the beginning.
        getMemoized: function(bucket, key, getterFunc, useMemo, conditionalFunc) {
          return memoize(bucket, key, getterFunc, useMemo, conditionalFunc);
        },

        // Simple redirecting method, supporting both urls and hash bang paths,
        // used internally for redirecting within controllers' response.
        redirectTo: redirectToPath,

        // The renderer can be called directly if needed for manual partials
        // renderings. The renderer will be either the default one (built-in),
        // or the one set through the `setRenderer` method below.
        render: templateRenderer
      },


      // A boolean indicator whether the app has been started, useful for tests.
      isRunning: function() {
        return running;
      },


      // This method will selectively turn debug logging on or off at runtime.
      setDebug: function(value) {
        if (value !== 'undefined') {
          debugging = value;
        }
        spaLog('jQuery SPA (Single Page App) v' + SPA_VERSION);
        spaLog('https://github.com/dejanstrbac/spa');
        spaLog('~~~~ ~~~ ~~~ ~~~ ~~~ ~~~~ ~~~~ ~~~');
        spaLog('Debug mode enabled');
        return debugging;
      },


      // If the default renderer (templating engine) won't do, a new one
      // can be set via this method. The signiture is function(template, data),
      // where template is a `text/html` file and data is of JSON format.
      setRenderer: function(newRenderer) {
        customRenderer = newRenderer;
      },


      // With this method we can extend in bulk the helpers object below.
      // Adding single methods is also easy by directly defining them on
      // the `spaApp.helpers`.
      addHelpers: function(newHelpers) {
        extendMethods(this.helpers, newHelpers);
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
            extendMethods(controllers[c], newControllers[c]);
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
        extendMethods(callbacks, newCallbacks);
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
      },


      // Start the app by triggering the router to start listening for path
      // changes. The method has been wrapped in anonymous action for future changes.
      run: function() {
        return startRouter();
      }


    };

  };
})(window, document, $);
