
/*
 *             mm###########mmm
 *          m####################m
 *        m#####`"#m m###"""'######m
 *       ######*"  "   "   "mm#######
 *     m####"  ,             m"#######m       SPA (Single Page App) / jQuery
 *    m#### m*" ,'  ;     ,   "########m      
 *    ####### m*   m  |#m  ;  m ########      https://github.com/dejanstrbac/spa
 *   |######### mm#  |####  #m##########|
 *    ###########|  |######m############
 *    "##########|  |##################"
 *     "#########  |## /##############"
 *       ########|  # |/ m###########
 *        "#######      ###########"
 *          """"""       """""""""
 */

;(function( $ ) {
  $.fn.spa = $.fn.spa || function() {

    // Start by memoizing the container element. By attaching to the container,
    // multiple containers & spa apps should be theoretically supported, while 
    // they would have to share URL namespace and routes.
    var containerElement = this,
        
        // Previous app state is saved given in the request to the controller as
        // aid for context determination. In most cases it is not needed or used,
        // but could be helpful for having a "last seen products" etc.
        previousHash   = null, 
        previousParams = null, 

        // When hash listeners are not supported in older 
        // browsers, we will poll for hash changes every 333 milliseconds.
        pollingInterval = 333,

        // The SPA app logic is contained in the following objects. Contents
        // are injected via public interfaces.
        routes      = [],        
        controllers = {},
        callbacks   = {},
        
        // All templates are stored in memory so no repetitive DOM access is needed.
        templatesMemo = {         
          '404': '<h1>404 Page not found</h1>'
        },

        // Helper memo for aiding memoization in helpers and controllers,
        // so extraction  from payload is optimized.
        objectsMemo = {},

        // There is quite a lot of stuff happening within SPA, although fairly
        // simple. Having some logging in development mode might be helpful.
        debugging = false,

        // Simple conditional internal logging method to analyze the flow
        // throughout the spa application.
        spaLog = function(msg) { 
          if (debugging) { 
            console.log(msg); 
          } 
        },


        // SPA framework uses extensively memoization (caching) internally, as
        // in catalog-like web apps, the likelyhood to browse back to a page is
        // very high. the same mechanisms are opened for app use, by making this 
        // method public.
        memoize = function(bucket, key, getterFunc, shouldMemoize) {                 
          if (typeof shouldMemoize === 'undefined') { 
            shouldMemoize = true; 
          }
          
          if (shouldMemoize) {
            // If the given key is an Array, casting to string will join its 
            // elements [1,2] => "1,2" which is again sufficient for the key.
            key = key.toString();

            // Buckets allow to separate key/values by semantical meaning of 
            // the values in the application.
            bucket = bucket.toString();            
            objectsMemo[bucket] = objectsMemo[bucket] || {};        

            // Simply check if the memo key is defined on the bucket.
            // Set it if it does not, otherwise just return it.
            if (!objectsMemo[bucket].hasOwnProperty(key)) {
              spaLog('(spa) mem miss: ' + bucket + '[' + key + ']');
              if (typeof getterFunc !== 'undefined') {
                objectsMemo[bucket][key] = getterFunc(key);
              }
            } else {
              spaLog('(spa) mem hit: ' + bucket + '[' + key + ']');
            }
            return objectsMemo[bucket][key];
          } else {
            // Memoization is being skipped. If there was an existing memorized 
            // value it should be invalidated/removed.
            if (objectsMemo[bucket] && objectsMemo[bucket].hasOwnProperty(key)) {
              delete objectsMemo[bucket][key];
            }
            return getterFunc(key);
          }
        },


        // We need a simple way of redirecting, by default to SPA hash bang
        // paths, buy also possibly with a different url method. This can for
        // instance be used in the response from the controller, by returning
        // a redirect option (see below).
        redirectToPath = function(destinationHashPath, url) {
          if (typeof url === 'undefined') {
            spaLog('(spa) redirecting page: ' + destinationHashPath);
            location.hash = '#!' + destinationHashPath;
          } else {
            location = url + (destinationHashPath || '');
          }
        },


        // Not all browser support the onhashchange event. We must check
        // and if not supported fallback to alternative solution of polling.
        // The check is taken from Modernizr.js: documentMode logic from YUI to filter 
        // out IE8 Compatibility Mode which gives false positives.
        isHashChangeSupported = function() {
          return ('onhashchange' in window) && 
                 (document.documentMode === undefined || document.documentMode > 7);
        },


        // Starts the SPA app router, not forgetting to process the current 
        // hash path, so the SPA app jumps to the desired state - as in the 
        // case of copy/pasting a whole url.
        startRouter = function() {                                                         
          if (isHashChangeSupported()) {
            $(window).bind('hashchange', router);
          } else {          
            setInterval(router, pollingInterval);
          }              
          router();                                                             
        },


        // There are callbacks defined in multiple places in the router,
        // such as beforeRender, afterRender etc. The logic is the same,  
        // so this method has been extracted out and generalized. There are
        // two levels of callbacks, one on the app level, which will run for
        // every controller, and there are callbacks on the controller level.
        // Controller callbacks have higher priority than the app ones as they
        // are closer to the logic code.
        runCallbacks = function(callbackName, request, response) {
          if (controllers[request.controller][callbackName]) {                  
            (controllers[request.controller][callbackName])(request, response);                   
            spaLog('(spa) callback ' + request.controller + '.' + callbackName + '()');
          }
          if (callbacks[callbackName]) {                                                     
            (callbacks[callbackName])(request);
            spaLog('(spa) callback ' + callbackName + '()');
          }
        },


        // SPA includes own simple dummy renderer. It can be redefined by calling 
        // setRenderer() which will override this method. If there is a problem, 
        // it should return null or false.
        templateRenderer = function(template, data) {          
          for(var p in data) {
            if (data.hasOwnProperty(p)) {
              template = template.replace( new RegExp('{{'+p+'}}','g'), data[p] );
            }
          }
          return template;
        },


        // @TODO: We need a preloader here of content. Currently not so dry.
        //   routeEntry = routeFor(urlpath)
        //   response = ...
        // maybe even use it in the router
          

        // Rendering, wrapping and setting of the template into the defined
        // application container. Wrapping is done so that the effort of 
        // insertion as well deletion is minimal on the DOM. At the same time, 
        // removal is done before setting so that the possible events are cleared, 
        // preventing memory leaks.
        renderTemplate = function(templateId, data, options) {
          var template      = templatesMemo[templateId],
              renderedView  = null,
              cacheKey      = null ;

          data    = data    || {};
          options = options || {};

          // The cache key is the template name for nonmutating views, where the 
          // attribute cache is just set to true. To cache same views but for 
          // different data, the attribute cache needs to be set to some data 
          // that will uniquely identify it - e.g. ID of a product.
          if (options.cache) {
            if (options.cache === true) {
              cacheKey = templateId;
            } else {
              cacheKey = templateId + '-' + options.cache;
            }
          }

          // Using the same memoization mechanism defined above, we will 
          // cache the views that allow it, so they do not need to be re-rendered.
          renderedView = memoize('spa__views', cacheKey, function() {
            var tmpView = null;
            if (template) {
              tmpView = templateRenderer(template, data);              
              if (tmpView) {
                return '<div id="spa__wrap">' + tmpView + '</div>';
              } else {
                throw new Error('(spa) template could not be rendered >> ' + templateId);
              }
            } else {
              throw new Error('(spa) template does not exist >> ' + templateId);
            }
          }, (cacheKey !== null));

          containerElement.empty().html(renderedView);
        },
        

        // Parsing of the the current location hash and splitting it in 
        // REST-like parameters which are returned.
        getParams = function(str) {
          var qs       = str || location.hash,
              params   = {},
              qsArray,
              pair;
          if (qs.match(/^\#\!/)) {
            qsArray = qs.substr(3).split('/');
            while (qsArray.length != 0) {
              pair = qsArray.splice(0, 2);
              params[ pair[0] ] = pair[1];
            }
          }
          return params;
        },

        
        // Finding out the current route based on the information passed into
        // the hash, and returning the route entry with all its content back.
        // SPA routes start with '#!'' - (hash bang).
        getRouteFor = function(hash) {
          var currentRoute = null;
          // We will first try matching the root route, as with highest priority.
          if (hash.match(/^$|^#(?!\!).+/)) {
            currentRoute = routes.slice(-1)[0]; 
          } else if (hash.match(/^\#\!.+/)) {
            for (var i = 0; (i < routes.length) && !currentRoute; i+=1) {                
              if (RegExp(routes[i].url).test(hash.slice(2))) {                
                currentRoute = routes[i]; 
              }
            }
          }
          return currentRoute;
        },


        // Router is invoked on every hash change. The route is parsed and 
        // compared to predefined routes. Matching controller/action is then 
        // called and passed parameters found in the hash.
        router = function() {
          var currentHash       = location.hash || '#!/',
              pollingAllowed    = true,
              matchedRouteEntry = null,
              request           = null,
              response          = null,             
              templateToRender  = null;     
          

          if (pollingAllowed && (currentHash !== previousHash)) {
      
            // In case of older browsers (IE6/7), where we use hash polling instead 
            // of hash change events, polling needs to be terminated when we are 
            // still on the same page, so unneccessary continous calls to the same 
            // controller/action & re-renderring is avoided.
            pollingAllowed = false;
            matchedRouteEntry = getRouteFor(currentHash);

            if (!matchedRouteEntry) {
              // The Route has not been recognized and we need to simulate 404.
              // The 404 template can be defined just as any other.
              renderTemplate('404', null, { cache: true });
            } else {
              request = {
                path           : currentHash,
                previousPath   : previousHash,                
                params         : getParams(currentHash),
                previousParams : previousParams,
                controller     : matchedRouteEntry.controller,
                action         : matchedRouteEntry.action || 'handler'
              }
              
              // Run the callbacks defined in controller and on top level. Note
              // that the response doesn't exist yet so it is not passed here.              
              runCallbacks('beforeFilter', request);
              
              // Call the respective route's defined action with the params 
              // fetched from the hash and pass in the previous ones for possible
              // context determination of the origin page if needed.
              response = (controllers[request.controller][request.action])(request);

              // The afterFilter callback might be useful, if we are not concerned 
              // whether the controller action responded at all, but still need
              // to do after controller processing.
              runCallbacks('afterFilter', request, response);

              // If the controller action responed to hash parameters with data,
              // we can proceed to callbacks and rendering.
              if (response) {
                // The beforeRender callback might be useful for cleaning up the
                // previous view or detaching some events.
                runCallbacks('beforeRender', request, response);

                // Assume the controller name for the template and using
                // single action controllers called 'handler'.
                templateToRender = request.controller;
           
                // The controller can pass a name of the template to render 
                // in the options  part of the response. Otherwise it can be
                // assumed by the action name.
                if (response.options && response.options.template) {
                  templateToRender = response.options.template;
                  delete response.options.template;
                } else if (request.action) {                                    
                  // If action is passed, we will assume that action name 
                  // as template definition.
                  templateToRender += '__' + request.action;
                } 
                response.options.template = templateToRender;

                // Some controller actions have no need of a rendered response.
                // Those can be popups for instance, triggered by hash changes.
                if (response.options.renderNothing) {
                  spaLog('(spa) template bypassed');
                } else {
                  // Finally the template is rendered and the data and options given
                  // from the action are passed into.
                  renderTemplate(templateToRender, response.data, response.options);

                  // The afterRender callback is usually the place where DOM events 
                  // should be attached to the newly rendered html.
                  runCallbacks('afterRender', request, response);

                  // We must ensure we are scrolling to the page top, 
                  // to simulate a well known page load behaviour
                  $("body,html,document").scrollTop(0);
                }

                // The response returned can ask for the app to redirect the page,
                // most likely to another SPA hash bang path, but also to another url.
                // Since this parameter runs late, after rendering, it can be nicely
                // combined with renderNothing option or special template.
                if (response.options.redirectTo) {                  
                  redirectToPath(response.options.redirectTo);
                }

              } else {
                // The route has been recognized, but the controller returned an 
                // empty response probably the object does not exist in the 
                // payload (like wrong id).
                renderTemplate('404', null, { cache: true });
              }

              // Previous hash and exploded params out of it are kept
              // so they can be given in the next request's hash, as a 
              // context aid.
              previousParams = request.params;
              previousHash   = currentHash;

              // The handler of the route is finishing and polling is allowed
              // again - influences only older browsers.
              pollingAllowed = true;
            }
          }        
        };

    // Ensure there is a container of jQuery object / DOM element
    // to work with as a SPA. The rendering of pages will happen there.
    if (!containerElement.length) {
      throw new Error('(spa) container does not exist');
    }    
    
    // Views templates are fetched at initialization time and memoized into a 
    // templatesMemo object from where they will be used instead from the DOM. 
    $("script[type='text/html']").map( function(i, el) {       
      var templateEl   = $(el),
          templateName = templateEl.attr('id');
      
      if (templateName.substr(0,5) === 'spa__') {
        templateName = templateName.substring(5);
      }
      templatesMemo[templateName] = templateEl.html();
    });

    // Expose public interfaces to the SPA object, so controllers/actions
    // and routes can be injected.
    return {

      // The helpers object exposes some of the internals which might be found
      // useful in the application, like templates, redirects and memoization.
      // It is recommended to extend this object with own methods via 
      // the addHelpers defined below, so everything related to this SPA app
      // is kept in one object and place.
      helpers: {

        redirectTo: function(hashPath, url) {
          redirectToPath(hashPath, url);
        },

        existsTemplate: function(templateName) {
          return templatesMemo.hasOwnProperty(templateName);
        },

        getTemplate: function(templateName) {
          if (templatesMemo.hasOwnProperty(templateName)) {
            return templatesMemo[templateName];
          }
        },    

        getMemoized: function(bucket, key, getterFunc, shouldMemoize) {
          return memoize(bucket, key, getterFunc, shouldMemoize);
        }
      },

      // Method which will selectively turn debug logging on or off.
      setDebug: function(value) {                                               
        if (typeof value !== 'undefined') {
          debugging = value;
        }
      },


      // If the default renderer (templating engine) won't do, a new one 
      // can be set via this method. The signiture is function(template, data),
      // where template is a text/html file and data is of JSON format.
      setRenderer: function(newRenderer) {
        delete(templateRenderer);
        templateRenderer = newRenderer;
      },


      // With this method we can extend in bulk the helpers object below.
      // Adding single methods is also easy by directly defining them on
      // the spaApp.helpers.
      addHelpers: function(newHelpers) {
        $.extend(this.helpers, newHelpers);
      },


      // Controllers hold the main app logic/actions and are injected here, 
      // by extending the private object `controllers`. The argument 
      // `newControllers` is expected to be an object whose properties are 
      // controllers of own properties which are actions. 
      //
      // Properties with the following names beforeRender, afterRender, 
      // beforeFilter & afterFilter define controller callbacks. To selectively
      // execute code in the callback for specific action, you can switch over 
      // the property `action` of the request argument, containing the name
      // of the routed controller action.
      //
      // Example of a valid controller object:
      //  {
      //    pages: {
      //       show: function(request) {
      //          // generate some response and then return it as an object
      //       }
      //    },
      //    afterRender: function(request, response) {
      //                  if (request.action == 'show') {
      //                    // some logic for the `show` action. 
      //                  }
      //                }
      //  }    
      addControllers: function(newControllers) {
        $.extend(controllers, newControllers);
      },      


      // Callbacks are methods which need to run after specific events in the code.
      // While controllers can defined own callback which are of higher priority,
      // here app level callbacks can be attached. The argument `newCallback` is 
      // expected to be an object whose properties are callbacks with possible names 
      // beforeRender, afterRender, beforeFilter & afterFilter define callbacks. 
      // To selectively execute a callback for specific action, we can switch over 
      // the name of the action present in the request argument. 
      //
      // Example of a valid callback:
      //
      //  { 
      //    afterRender: function(request, response) { 
      //                    if (request.action == 'show') {
      //                      // do something here
      //                    }
      //                  }
      //  }
      //
      addCallbacks: function(newCallbacks) {
        $.extend(callbacks, newCallbacks);
      },


      // Routes map url hash bang paths to controllers and their respective 
      // actions. First added routes have higher priority as they are matched 
      // via regular expressions. The argument `newRoutes` is expected to be an 
      // array of object paths. 
      //
      // Example of a valid array of object paths:
      //
      //  [ 
      //    { url: '^/product/[0-9]+$', controller: 'product', action: 'show' },
      //    { url: '^/action/',         controller: 'actions'                 }
      //  ]
      //
      // If action property is ommited as above, the app will assume it's 
      // called `handler`. You can define as many routes as needed.
      addRoutes: function(newRoutes) {
        $.merge(routes, newRoutes);
      },
      

      // Start the app by triggering the router to start listening for path
      // changes. The method has been wrapped in anonymous action for future changes.
      run: function() {
        startRouter();
      }

    };

  };
})( jQuery );
