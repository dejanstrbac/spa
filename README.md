

              mm###########mmm
           m####################m
         m#####`"#m m###"""'######m
        ######*"  "   "   "mm#######
      m####"  ,             m"#######m       SPA (Single Page App) / jQuery
     m#### m*" ,'  ;     ,   "########m      
     ####### m*   m  |#m  ;  m ########      https://github.com/dejanstrbac/spa
    |######### mm#  |####  #m##########|
     ###########|  |######m############
     "##########|  |##################"
      "#########  |## /##############"
        ########|  # |/ m###########
         "#######      ###########"
           """"""       """""""""


[SPA] - Single Page Apps Framework for jQuery
=============================================

Requires: 
  * [jQuery](http://jquery.com/) 
  * [Underscore.js](http://documentcloud.github.com/underscore/)
  * [Mustache.js](https://github.com/janl/mustache.js) 
  

Usage:

  1) Include needed libraries

  2) Define templates

  3) Initialize data, controllers and routes. Then run();

    var jsonPayload = {}; // your own JSON data, best outside of jQuery ready listener

    $(function() {
      
      var mySpa = $('#app_container').spa();    // move outside if you need the variable globally accessible

      mySpa.addControllers({
                product: {
                  handler: function (params) {
                      // do something here with the params array passed 
                      // and return data you want for the template
                      return {
                        // data to be passed to the template
                      }; 
                    }
                  },
                  template: 'product' // template to render
                },
                home: {
                  handler: function (params) {
                      // fetch home page data...
                      return {  // return data for the home page template
                      }; 
                    }
                  },
                  template: 'product' // template to render
                }
      });

    });

    mySpa.addRoutes([        
      { url: 'product=', controller: 'product' }, // highest priority on the top...
      { controller: 'home' }                      // ...last route is always root - lowest priority, url can be excluded
    ]);

    mySpa.run(); // Kalabunga!



