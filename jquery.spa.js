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
    var containerElement  = this,
        
        // Previous app state is saved given in the request to the controller as
        // aid for context determination. In most cases it is not needed or used,
        // but could be helpful for having a "last seen products" etc.
        previousHash      = null, 
        previousParams    = null, 

        // When hash listeners are not supported in older 
        // browsers, we will poll for hash changes
        pollingInterval = 333,

        // The SPA app logic is contained in the following objects. Contents
        // are injected via public interfaces.
        routes        = [],        
        controllers   = {},
        callbacks     = {},
        
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


        redirectToPath = function(destinationPath) {
          spaLog('(spa) redirecting page: ' + destinationPath);
          location.hash = '#!' + destinationPath;
        },


        // Not all browser support the onhashchange event. We must check
        // and if not supported fallback to alternative solution of polling.
        // The check is taken from Modernizr.js: documentMode logic from YUI to filter 
        // out IE8 Compatibility Mode which gives false positives
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


        runCallbacks = function(callbackName, request, response) {
          if (callbacks[callbackName]) {                                                     
            (callbacks[callbackName])(request);
            spaLog('(spa) callback ' + callbackName + '()');
          }
          if (controllers[request.controller][callbackName]) {                  
            (controllers[request.controller][callbackName])(request, response);                   
            spaLog('(spa) callback ' + request.controller + '.' + callbackName + '()');
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
          var currentHash       = window.location.hash || '#!/',
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

                if (response.options.redirectTo) {                  
                  redirectToPath(response.options.redirectTo);
                }

              } else {
                // The route has been recognized, but the controller returned an 
                // empty response probably the object does not exist in the 
                // payload (wrong id e.g.)
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

      helpers: {
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

      setDebug: function(value) {                                               
        if (typeof value !== 'undefined') {
          debugging = value;
        }
      },

      setRenderer: function(newRenderer) {
        templateRenderer = newRenderer;
      },

      addHelpers: function(newHelpers) {
        $.extend(this.helpers, newHelpers);
      },

      addControllers: function(newControllers) {
        $.extend(controllers, newControllers);
      },      

      addCallbacks: function(newCallbacks) {
        $.extend(callbacks, newCallbacks);
      },

      addRoutes: function(newRoutes) {
        $.merge(routes, newRoutes);
      },
      
      run: function() {
        startRouter();
      }

    };

  };
})( jQuery );
