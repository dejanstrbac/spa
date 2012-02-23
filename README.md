

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

SPA is a lightweight jQuery plugin that allows for DVC (Data-View-Controller) that are read/browse heavy.
Most common use case is in ecommerce where the catalog data does not require often reloads. 
SPA has been inspired by Amazon's MyHabit flash sales website.

How does it work?
-----------------

Your server renders a page which includes all the catalog data in JSON, assigned to a javascript variable.
SPA is loaded and its controllers access this JSON payload, process it and render the templates.

Routing is based on hash bang pattern "www.example.com/#!product=23&category=45". Root is simply a '#'.

For the ones concerned about the size of the payload, JSON is text data, easy to handle with gzip compression headers.

Browsing around the site can  completely be offloaded to the user, and request to the servers can be
made only for the parts that require server intervention. In an ecommerce app, that would be loging in or 
shopping cart modifications, and redirecting to the server for purchase completion.

Note that this is very early stage project, and lacks tests. Contributions are welcome!


Dependencies 
------------

  * [jQuery](http://jquery.com) 

Examples use [mustache.js](https://github.com/janl/mustache.js) but that is only a matter of taste. I prefer logic-less templates. 
You can use any engine you wish by defining your renderer.

[underscore.js](http://documentcloud.github.com/underscore/) fits naturally here as you will probably be parsing potentially huge amounts of JSON data.
Functional helpers might be of good use. Underscore also has own templating engine so you might prefer that one instead of mustache. 
The supplied example uses underscore for filtering the JSON data.


Usage
-----

  1) Include needed libraries

      <script src="jquery.min.js" type="text/javascript"></script>
      <script src="jquery.spa.js" type="text/javascript"></script>

      <!-- mustache.js is not required -->
      <script src="jquery.mustache.js" type="text/javascript"></script>


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

        var jsonPayload = {...}; // your own JSON data
        

  4) Define the container for the dynamic content
          
        var mySpa = $('#app_container').spa();


  5) Define your template rendering engine - in this case Mustache.js

        mySpa.setRenderer( function(template, data) {          
          return Mustache.render(template, data) // render the templates as you wish here
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
              // template: 'product' // assumed - define if using different than the name of the controller
              // beforeRender
              // afterRender
            },
            home: {
              handler: function (params) {
                  // fetch home page data...
                  return {  
                    // return data for the home page template
                  }; 
                }
              },
              // template: 'home' // assumed - define if using different than the name of the controller
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