

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

This is a jQuery add-on  for read heavy javascript apps e.g. ecommerce apps.
The server will render the page which includes all the catalog data in JSON variable. 
For the concerned ones, JSON is text data, easy to handle with gzip compression headers.
Browsing around the site can now completely be offloaded to the user, and request to the servers can be
made only for the parts that require server intervention.

In an ecommerce app, that would be - contacting the server via ajax on shopping cart update, and 
redirecting to the server for purchase completion.

Note that this is very early stage project, and lacks tests.


Dependencies: 
-------------

  * [jQuery](http://jquery.com/) 
  * [underscore.js](http://documentcloud.github.com/underscore/)
  * [mustache.js](https://github.com/janl/mustache.js) 

Even though underscore.js includes own template engine, mustache is logic less which fits my taste better now.


Usage:

  1) Include needed libraries

      <script src="jquery.min.js"></script>
      <script src="underscore.min.js"></script>
      <script src="jquery.mustache.js"></script>
      <script src="jquery.spa.js"></script>


  2) Define templates


      <div id="spa__home" class="spa__template" style="display:none">
        <h1>{{product.title}}</h1>
      </div>

      <div id="spa__product" class="spa__template" style="display:none">
        <h1>{{product.title}}</h1>
      </div>

      <div id="spa__404" class="spa__template" style="display:none">
        <h1>Page not found!</h1>
      </div>



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



TODO:

  * possibility to select or inject own template engine
  * tests
  * multi-action controllers
  * urlTo is unused, a way to standardize links maybe
  * can template name be assumed from the controller/action name?