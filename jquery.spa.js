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
        memoizedTemplates = {},   //
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


        renderTemplate = function(name, data) {
          var template = memoizedTemplates[name],
              renderedTemplate;
          if (template) {
            renderedTemplate = templateRenderer( template, data, memoizedTemplates);            
            // wrapping with a single element lowers the DOM insertion effort
            // as we do not know the content being rendered
            renderedTemplate = '<div id="spa__wrap">' + renderedTemplate + '</div>';
            containerElement.html( renderedTemplate );
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
              qs = qs.substr(2).split('+').join(' ');
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
              matchedRoute = routes[i];
            }
          }
          return matchedRoute;
        },


        router = function() {
          var currentHash = window.location.hash,
              routeEntry,
              routedController,
              routedAction,
              newTemplateData,
              templateToRender;
          
          if(currentHash != legacyHash) { 
            legacyHash = currentHash;   // in case we are polling

            if (currentHash.match( /^$|^#(?!\!).+/ )) {     // empty hash or anchor hash
              routeEntry = routes.slice(-1)[0];             // root controller is the last one defined
            } else if (currentHash.match(/^\#\!.+/)) {
              routeEntry = routeTo( currentHash );          // hash present and requesting routing
              if (!routeEntry) {                            // router failed to recognize the route
                renderTemplate('404');
                return;
              }
            }

            routedController = controllers[ routeEntry.controller ];
            routedAction = routedController[ routeEntry['action'] || 'handler' ];
                        
            paramsState = getParams();  // keep the old params available
            newTemplateData = routedAction( paramsState );
            if (newTemplateData) {

              if (routedController.beforeRender) {
                routedController.beforeRender( newTemplateData.data, templateData );
              }
              
              // if using actions, the default template is defined by the action
              
              templateToRender = routeEntry['controller']; // assume the controller name for the template
              if (newTemplateData.options && newTemplateData.options['template']) { // has the controller passed a template to render?
                templateToRender = newTemplateData.options['template'];
              } else if (routeEntry['action']) {                                    // if action passed, assume action name as template
                templateToRender += '__' + routeEntry['action'];
              } 
              renderTemplate( templateToRender || routedController.template, newTemplateData.data );

              if (routedController.afterRender) {
                routedController.afterRender( newTemplateData.data, templateData );
              }

              templateData = newTemplateData.data;
            } else {
              renderTemplate('404');
            }
          } 
        };


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
      memoizedTemplates[ templateName ] = templateEl.html();
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