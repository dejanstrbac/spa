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
  
    var containerElement,         // - memoize the container element as it is accessed often
        paramsState,              // - in case we update some value in url, keeping here the remaining context
        legacyHash,               //
        memoizedTemplates,        //
        templateData,

        controllers = {},         // - developer defined controllers       
        routes      = [],         //   and routes are attached here


        isHashChangeSupported = function() {
          // Modernizr check documentMode logic from YUI to filter out 
          // IE8 Compatibility Mode which gives false positives.
          return ('onhashchange' in window) && (document.documentMode === undefined || document.documentMode > 7);
        },


        templateRenderer = function() {
          throw new Error('(SPA) no template renderer defined');
        },


        renderTemplate = function(name, data, partials) {
          var template = memoizedTemplates[name];
          if (template) {
            containerElement.html( templateRenderer( memoizedTemplates[name], data) );
          } else {
            throw new Error('(SPA) template does not exist >> ' + name);
          }
        },


        getParams = function() {
            var qs     = location.hash,
                params = {},
                tokens = null,
                re     = /[?&]?([^=]+)=([^&]*)/g;

            if (qs.match(/^\#\!/)) {
              qs = qs.substr(2).split("+").join(" ");
              while (tokens = re.exec(qs)) {
                  params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
              }              
            }
            return params;
        },


        routeTo = function(hUrl) {
          var matchedRoute;
          for (var i = 0; (i < routes.length) && !matchedRoute; i++) { // stop as soon as a matching route is found
            if (hUrl.indexOf(routes[i].url) > 0) {
              matchedRoute = routes[i].controller;
            }
          }
          return matchedRoute;
        },


        router = function() {
          var currentHash = window.location.hash,
              routedController,
              newTemplateData,
              template;
          
          if(currentHash != legacyHash) { 
            legacyHash = currentHash;   // in case we are polling

            if (currentHash.match(/^$|^#(?!\!).+/)) {                 // empty hash or anchor hash
              routedControllerName = routes.slice(-1)[0].controller;  // root controller is the last one defined
            } else if (currentHash.match(/^\#\!.+/)) {
              routedControllerName = routeTo( currentHash );          // hash present and requesting routing
              if (!routedControllerName) {                            // router failed to recognize the route
                renderTemplate('spa__404');
                return;
              }
            }

            routedController = controllers[routedControllerName];
            paramsState = getParams();
            newTemplateData = routedController.handler( paramsState );
            if (newTemplateData) {

              if (routedController.beforeRender) {
                routedController.beforeRender(newTemplateData, templateData);
              }

              renderTemplate( 'spa__' + routedController.template, newTemplateData);

              if (routedController.afterRender) {
                routedController.afterRender(newTemplateData, templateData);
              }

              templateData = newTemplateData;
            } else {
              renderTemplate('spa__404');
            }
          } 
        };


    containerElement = this;
    if (!containerElement.length) {
      throw new Error('(SPA) container does not exist');
    }
    
    memoizedTemplates = {};
    $('.spa__template').map( function(i, el) { 
      var template = $(el);
      memoizedTemplates[ template.attr('id') ] = template.html();
    });


    return {
      run: function() {
        if (isHashChangeSupported()) {
          $(window).bind('hashchange', router);
        } else {          
          setInterval(router, 333); // IE 6, IE 7 and other hairdryers support
        }      
        router(); // on page load, pass through router to check if there 
                  // is an initial request - copy/pasted link
      },

      currentState: function() {
        return paramsState;
      },

      addControllers: function(newControllers) {
        for (var c in newControllers) {
          if (newControllers.hasOwnProperty(c)) {            
            if (!newControllers[c].template) {
              newControllers[c].template = c.toString();
            }
            controllers[c] = newControllers[c];
          }
        }
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