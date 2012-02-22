

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


[SPA] - Single Page Apps with jQuery
====================================

This is a jQuery add-on  for read heavy javascript apps e.g. ecommerce apps.
The server will render the page which includes all the catalog data in JSON variable. 
For the concerned ones, JSON is text data, easy to handle with gzip compression headers.
Browsing around the site can now completely be offloaded to the user, and request to the servers can be
made only for the parts that require server intervention.

In an ecommerce app, that would be - contacting the server via ajax on shopping cart update, and 
redirecting to the server for purchase completion.

Note that this is very early stage project, and lacks tests.


Dependencies 
------------

  * [jQuery](http://jquery.com) 
  * [mustache.js](https://github.com/janl/mustache.js) 

Using mustache.js is only a matter of taste here. I prefer logic-less templates.
[underscore.js](http://documentcloud.github.com/underscore/) fits naturally here as you will be parsing potentially huge amounts of JSON data, 
so functional helpers might be of good use. The supplied example uses underscore.


Usage
-----

  1) Include needed libraries

      <script src="jquery.min.js"></script>
      <script src="jquery.mustache.js"></script>
      <script src="jquery.spa.js"></script>


  2) Define templates including 404

      <div id="spa__home" class="spa__template" style="display:none">
        <h1>{{product.title}}</h1>
      </div>

      <div id="spa__product" class="spa__template" style="display:none">
        <h1>{{product.title}}</h1>
      </div>

      <div id="spa__404" class="spa__template" style="display:none">
        <h1>Page not found!</h1>
      </div>


  3) Initialize data

        var jsonPayload = {}; // your own JSON data, best outside of jQuery ready listener
        

  4) Define the container for the dynamic content
          
        var mySpa = $('#app_container').spa();


  5) Define your template rendering engine - in this case Mustache.js

        mySpa.setRenderer( function(template, data) {
          return Mustache.render(template, data)
        });


  6) Add your single action controllers

          mySpa.addControllers({
            product: {
              handler: function (params) {
                  // do something here with the params array passed 
                  // and return data you want for the template to show, or return null to show 404.
                  return {
                    // data to be passed to the template
                  }; 
                }
              },
              template: 'product'
            },
            home: {
              handler: function (params) {
                  // fetch home page data...
                  return {  
                    // return data for the home page template
                  }; 
                }
              },
              template: 'home'
            }
          });

        });


  7) Add your routes

        mySpa.addRoutes([        
          { url: 'product=', controller: 'product' }, // highest priority on the top...
          { controller: 'home' }                      // ...last route is always root - lowest priority, url can be excluded
        ]);


  8) Run and pull the cork out!

        mySpa.run();


TODO
-----
  * tests
  * multi-action controllers? y/n?
  * can template name be assumed from the controller/action name?