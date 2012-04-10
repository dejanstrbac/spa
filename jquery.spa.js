
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
  
    var containerElement,         // -> Memoize the container element as it is accessed often
        paramsState,              // -> In case we update some value in url, keeping here the remaining context
        previousHash,             // -> Save the hash in case of polling, so we execute only per change
        memTemplates = {          // -> All templates are stored in memory so no repetitive DOM access is needed
          '404': '<h1>404 Page not found</h1>'
        },
        viewsCache   = {},        // -> Views that can be cached are stored here 
        controllers  = {},        // -> Developer defined controllers       
        routes       = [],        // -> And routes are attached here
        DEBUG        = false,


        /* ---------------------------------------------------------------------- *
         * Not all browser support the onhashchange event. We must check
         * and if not supported fallback to alternative solution of polling.
         *
         * Check taken from Modernizr.js: documentMode logic from YUI to filter 
         * out IE8 Compatibility Mode which gives false positives
         * ---------------------------------------------------------------------- */
        isHashChangeSupported = function() {
          return ('onhashchange' in window) && 
                 (document.documentMode === undefined || document.documentMode > 7);
        },


        /* ---------------------------------------------------------------------- *
         * SPA includes own simple dummy renderer. It can be redefined by calling 
         * setRenderer() which will override this method.
         *
         * If there is a problem, it should return null or False.
         * ---------------------------------------------------------------------- */
        templateRenderer = function(template, data) {          
          for(var p in data) {
            if (data.hasOwnProperty(p)) {
              template = template.replace( new RegExp('{{'+p+'}}','g'), data[p] );
            }
          }
          return template;
        },


        /* ---------------------------------------------------------------------- *
         * Rendering, wrapping and setting of the template into the defined
         * application container.
         * 
         * Wrapping is done so that the effort of insertion as well deletion is
         * minimal on the DOM. At the same time, removal is done before setting
         * so that the possible events are cleared, preventing memory leaks.
         * ---------------------------------------------------------------------- */
        renderTemplate = function(templateId, data, options) {
          var template = memTemplates[templateId],
              renderedView,
              cacheKey;

          data    = data || {};
          options = options || {};

          // the cache key is the template name for nonmutating views, where the attribute cache 
          // is just set to true. To cache same views but for different data, the attribute cache
          // needs to be set to some data that will uniquely identify it - e.g. ID of a product.
          if (options.cache) {
            if (options.cache === true) {
              cacheKey = templateId;
            } else {
              cacheKey = templateId + '-' + options.cache;
            }
          }

          if (options.cache && viewsCache.hasOwnProperty(cacheKey)) {            
            // this view can be cached, and has been set already,
            // so we can just set the cached template
            renderedView = viewsCache[cacheKey];

            if (DEBUG) { console.log('used cached view: ' + cacheKey); }

          } else {
            if (template) {
              renderedView = templateRenderer( template, data );
              if (renderedView) {
                renderedView = '<div id="spa__wrap">' + renderedView + '</div>';

                if (DEBUG) { console.log('rendered template: ' + templateId); }

                if (options.cache) {
                  viewsCache[cacheKey] = renderedView;
                }
              }  else {
                throw new Error('(SPA) template could not be rendered >> ' + templateId);
              }
            } else {
              throw new Error('(SPA) template does not exist >> ' + templateId);
            }
          }
          containerElement.empty().html( renderedView );
        },


        /* ---------------------------------------------------------------------- *
         * Parsing of the the current location hash and splitting it in 
         * a HTTP/GET style into parameters which are returned.
         * ---------------------------------------------------------------------- */
        getParams = function(str) {
            var qs     = str || window.location.hash,
                params = {},
                tokens = null,
                re     = /[?&]?([^=]+)=([^&]*)/g;

            if (qs.match(/^\#\!/)) {
              qs = qs.substr(2).split('+').join(' ');
              while (tokens = re.exec(qs)) {
                  params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
              }              
            }
            return params;
        },


        /* ---------------------------------------------------------------------- *
         * Finding out the current route based on the information passed into
         * the hash, and returning the route entry with all its content back.
         * ---------------------------------------------------------------------- */        
        getRouteFor = function(hash) {
          var currentRoute;

          if (hash.match( /^$|^#(?!\!).+/ )) {  // root route or anchor
            currentRoute = routes.slice(-1)[0]; 
          } else if (hash.match(/^\#\!.+/)) {   // #! controller by params
            for (var i = 0; (i < routes.length) && !currentRoute; i++) {                
              if (hash.indexOf(routes[i].url) > 0) { 
                currentRoute = routes[i]; 
              }
            }
          }
          return currentRoute;
        },


        /* ---------------------------------------------------------------------- *
         * Router is invoked on every hash change. The route is parsed and 
         * compared to predefined routes. Matching controller/action is then 
         * called and passed parameters found in the hash.
         * ---------------------------------------------------------------------- */        
        router = function() {
          var currentHash = window.location.hash,

              routeEntry,           // -> holds the route entry respective to current url hash
              routedController,     // -> holds the controller for the recognized route above
              routedActionName,     // -> holds the name of the action in the controller to be called
              routedAction,         // -> points to the actual action function in the controller
              params,               // -> the new params in the url hash are split here
              responseData,         // -> the new data returned by the action
              templateToRender;     // -> the id of the template that needs to be rendered
          

          // we must ensure we do not loop the same route/action
          // in the case of IE6/7 polling technique
          if (currentHash !== previousHash) { 
            previousHash = currentHash; // stop polling immediately
            routeEntry = getRouteFor( currentHash );

            if (!routeEntry) {      
              // route has not been recognized      
              renderTemplate('404');
            } else {              
              routedController = controllers[ routeEntry.controller ];
              routedActionName = routeEntry['action'] || 'handler';
              routedAction = routedController[ routedActionName ];

              // Split the url hash params after the "#!".
              params = getParams( previousHash );  
              
              // call the respective route's defined action with the params 
              // fetched from the hash and pass in the previous ones for possible
              // context determination of the origin page if needed.
              responseData = routedAction( params, paramsState );               //TODO: here we should be checking for cache??
              paramsState = params;


              if (responseData) {
                // The action responed to these parameters with data.
                // Now the data is used for callbacks and rendering the view.


                // Before Render Callback
                if (routedController.beforeRender) {
                  if (DEBUG) { console.log('executing beforeRender callback'); }
                  routedController.beforeRender( responseData, routedActionName );
                }            


                // assume the controller name for the template and using
                // single action controllers called 'handler'
                templateToRender = routeEntry['controller'];   

           
                // the controller can pass a template to render in the options part of returned hash
                if (responseData.options && responseData.options['template']) {
                  templateToRender = responseData.options['template'];
                  delete responseData.options.template;
                } else if ( routeEntry['action'] ) {                                    
                  // if action passed, assume that action name as template definition
                  templateToRender += '__' + routeEntry['action'];
                } 

                
                // Finally the template is rendered and the data and options given
                // from the action are passed into.
                renderTemplate( templateToRender, responseData.data, responseData.options);


                // After Render Callback
                if (routedController.afterRender) {
                  if (DEBUG) { console.log('executing afterRender callback'); }
                  routedController.afterRender( responseData, routedActionName );
                }

                /* ------------------------------------------------------------------------------ */
              } else {
                // the route has been recognized, but the controller returned an empty response 
                // probably the object does not exist in the payload (wrong id e.g.)
                renderTemplate('404', null, { cache: true });
              }
            }
          }
        };


    /* ---------------------------------------------------------------------- *
     *  Actual initialization of the jQuery object with SPA happens here. The 
     *  templates are being fetched and memoized, as well the app container.
     * ---------------------------------------------------------------------- */        
    containerElement = this;
    if (!containerElement.length) {
      throw new Error('(SPA) container does not exist');
    }
    
    $("script[type='text/html']").map( function(i, el) { 
      var templateEl = $(el),
          templateName = templateEl.attr('id');

      if (templateName.substr(0,5) === 'spa__') {
        templateName = templateName.substring(5);
      }
      memTemplates[ templateName ] = templateEl.html();
    });


    /* ---------------------------------------------------------------------- *
     * Public interfaces to SPA element are returned upon the element call so
     * one can set controllers, renderer and routes.
     * ---------------------------------------------------------------------- */        
    return {

      run: function() {
        if (isHashChangeSupported()) {
          $(window).bind('hashchange', router);
        } else {          
          setInterval(router, 333);
        }      
        // on page load, pass through router to check if there 
        // is an initial request - e.g. copy/pasted link
        router();
      },

      getParams: function() {
        return paramsState;
      },      

      addControllers: function(newControllers) {
        $.extend(controllers, newControllers);
      },

      addRoutes: function(newRoutes) {        
        $.merge(routes, newRoutes);
      },

      setRenderer: function(newRenderer) {
        if ($.isFunction(newRenderer)) {
          templateRenderer = newRenderer;
        }        
      },
      
      setDebug: function(value) {
        DEBUG = value;
      }

    };

  };
})( jQuery );