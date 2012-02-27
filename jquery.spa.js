//
//               mm###########mmm
//            m####################m
//          m#####`"#m m###"""'######m
//         ######*"  "   "   "mm#######
//       m####"  ,             m"#######m       SPA (Single Page App) / jQuery
//      m#### m*" ,'  ;     ,   "########m      
//      ####### m*   m  |#m  ;  m ########      https://github.com/dejanstrbac/spa
//     |######### mm#  |####  #m##########|
//      ###########|  |######m############
//      "##########|  |##################"
//       "#########  |## /##############"
//         ########|  # |/ m###########
//          "#######      ###########"
//            """"""       """""""""
//
//

(function( $ ) {
  $.fn.spa = $.fn.spa || function() {
  
    var containerElement,         // -> memoize the container element as it is accessed often
        paramsState,              // -> in case we update some value in url, keeping here the remaining context
        savedHash,                // -> save the hash in case of polling, so we execute only per change
        memTemplates = {},        // -> all templates are stored in memory so no repetive DOM access is needed
        templateData,             // -> storing the previous data might give a better context to the controller
        controllers  = {},        // -> developer defined controllers       
        routes       = [],        //    and routes are attached here


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
         * SPA does not include own renderer. It must be defined by calling 
         * setRenderer() which will override this method.
         * ---------------------------------------------------------------------- */
        templateRenderer = function() {          
          throw new Error('(SPA) no template renderer defined');
        },


        /* ---------------------------------------------------------------------- *
         * Rendering, wrapping and setting of the template into the defined
         * application container.
         * 
         * Wrapping is done so that the effort of insertion as well deletion is
         * minimal on the DOM. At the same time, removal is done before setting
         * so that the possible events are cleared, preventing memory leaks.
         * ---------------------------------------------------------------------- */
        renderTemplate = function(name, data) {
          var template = memTemplates[name],
              view     = '<div id="spa__wrap">';

          if (template) {
            view += templateRenderer( template, data, memTemplates) + '</div>';
            containerElement.empty().html( view );
          } else {
            throw new Error('(SPA) template does not exist >> ' + name);
          }
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
        getCurrentRoute = function() {
          var currentHash = window.location.hash,
              currentRoute;

          if (currentHash != savedHash) { 
            savedHash = currentHash;
            if (currentHash.match( /^$|^#(?!\!).+/ )) { 
              currentRoute = routes.slice(-1)[0]; // root route
            } else if (currentHash.match(/^\#\!.+/)) {
              for (var i = 0; (i < routes.length) && !currentRoute; i++) {                
                if (currentHash.indexOf(routes[i].url) > 0) { 
                  currentRoute = routes[i]; 
                }
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
          var routeEntry       = getCurrentRoute(),
              routedController = controllers[ routeEntry.controller ],
              routedAction     = routedController[ routeEntry['action'] || 'handler' ],
              newTemplateData,
              templateToRender;
            
          if (!routeEntry) {      
            // route has not been recognized      
            renderTemplate('404');
          } else {                
            // keep the old params available to be passed to controllers
            paramsState = getParams(savedHash);  
            newTemplateData = routedAction( paramsState );
            if (newTemplateData) {

              if (routedController.beforeRender) {
                routedController.beforeRender( newTemplateData.data, templateData );
              }            

              // assume the controller name for the template              
              templateToRender = routeEntry['controller'];              
              // the controller can pass a template to render in the options part of returned hash
              if (newTemplateData.options && newTemplateData.options['template']) {
                templateToRender = newTemplateData.options['template'];
              } else if (routeEntry['action']) {                                    
                // if action passed, assume action name as template
                templateToRender += '__' + routeEntry['action'];
              } 
              renderTemplate( templateToRender || routedController.template, newTemplateData.data );

              if (routedController.afterRender) {
                routedController.afterRender( newTemplateData.data, templateData );
              }
              templateData = newTemplateData.data;
            } else {
              // the route has been recognized, but the controller
              // returned an empty response - probably the object does not exist
              // in the payload (wrong id most likely)
              renderTemplate('404');
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

      currentState: function() {
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
      }

    };

  };
})( jQuery );