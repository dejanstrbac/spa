//
//               mm###########mmm
//            m####################m
//          m#####`"#m m###"""'######m
//         ######*"  "   "   "mm#######
//       m####"  ,             m"#######m       SPA (Single Page App) / javascript
//      m#### m*" ,'  ;     ,   "########m      Copyright (c) 2012
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
  
    var containerElementName,
        containerElement,         //memoize the container as we will access it very often
        controllers,
        routes,
        paramsState,              // in case we update some value in url, here the remaining context stays
        legacyHash,
        memoizedTemplates,

        isHashChangeSupported = function() {
          // Modernizr check documentMode logic from YUI to filter out 
          // IE8 Compatibility Mode which gives false positives.
          return ('onhashchange' in window) && (document.documentMode === undefined || document.documentMode > 7);
        },

        renderTemplate = function(name, data, partials) { // partials are [optional]
          var template = memoizedTemplates[name];
          if (template) {
            containerElement.html( $.mustache( memoizedTemplates[name], data, partials) );
          } else {
            throw new Error( 'Template is not defined "' + name + '"' );
          }
        },


        getParams = function() {
            var qs = location.hash,
                params = {},
                tokens = null,
                re = /[?&]?([^=]+)=([^&]*)/g;

            if (qs.match(/^\#\!/)) {
              qs = qs.substr(2).split("+").join(" ");
              while (tokens = re.exec(qs)) {
                  params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
              }
              return params;
            }
        },


        urlFor = function (resources) {
          var completeUrl = '';
          for (var i = 0; i < resources.length; i++) {
            completeUrl += resources[i]['resource'] + '=' + resources[i]['id'];
          }
          return '#!' + completeUrl;
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
              templateData,
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
            paramsState = getParams() || {};
            //
            // TODO: if there is no template, but only callback defined, does it make sense?
            //
            templateData = routedController.handler( paramsState );        //pass parameters to the controller
            if (templateData) {
              renderTemplate( 'spa__' + routedController.template, templateData, routedController.partials);
            } else {
              renderTemplate('spa__404');
            }
          } 
        };


    containerElement = this;
    if (!containerElement.length) {
      throw new Error('(SPA) layout container does not exist');
    }
    
    // Memoize all templates so we don't have to access them on each render
    memoizedTemplates = {};
    $('.spa__template').map( function(i, el){ 
      var template = $(el);
      memoizedTemplates[ template.attr('id') ] = template.html();
    });


    //
    // Public interfaces are returned
    //
    return {
      run: function() {
        if (isHashChangeSupported()) { // Modernizer inspired
          $(window).bind('hashchange', router);
        } else {
          // IE 6, IE 7 and other hairdryers support
          setInterval(router, 333);
        }      
        router(); // on page load, pass through router to check if there is an initial request
      },

      currentState: function() {
        return paramsState;
      },

      addControllers: function(newControllers) {
        controllers = {};
        $.extend(controllers, newControllers); // TODO: can we not use underscore.js
      },

      addRoutes: function(newRoutes) {
        routes = [];
        $.merge(routes, newRoutes); // TODO: can we not use underscore.js
      }
    }

  };
})( jQuery );