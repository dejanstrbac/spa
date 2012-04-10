

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

WARNING: This is very early stage project, and lacks tests, and changes often. Documentation might be outdated already!
Nevertheless, contributions are welcome!


Dependencies 
------------

  * [jQuery](http://jquery.com) 

Examples use [mustache.js](https://github.com/janl/mustache.js) but that is only a matter of taste. I prefer logic-less templates. 
You can use any engine you wish by defining your renderer.

[underscore.js](http://documentcloud.github.com/underscore/) fits naturally in your controllers as you will probably be parsing potentially huge amounts of JSON data.
Functional helpers might be of good use. Underscore also has own templating engine so you might prefer that one instead of mustache. You are free to define your own renderer.
The supplied example uses underscore for filtering the JSON data.


Usage
-----

  1) Include needed libraries

      <script src="jquery.min.js" type="text/javascript"></script>
      <script src="jquery.spa.js" type="text/javascript"></script>

      <!-- mustache.js is not required - include any library you want to use for template rendering -->
      <script src="jquery.mustache.js" type="text/javascript"></script>


  2) Initialize data

        var jsonPayload = {...}; // your own JSON data
        

  3) Define the container for the dynamic content
          
        var mySpa = $('#app_container').spa();


  4) Define your template rendering engine - in this case Mustache.js

        mySpa.setRenderer( function(template, data) {          
          return Mustache.render(template, data) // render the templates as you wish here
        });


  5) Add your single action controllers by naming the action 'handler'. In case you want to use multiple actions
     per controller, you have to name the action in the route (see below).

          mySpa.addControllers({
            product: {
              handler: function (params) {
                  // do something here with the params array passed 
                  // and return data you want for the template to show, or return null to show 404.
                  return { 
                    data: {},     // data to be passed to the template
                    options: {} // any additional options to be passed before rendering                    
                  }; 
                }
              }
              // beforeRender callback
              // afterRender callback
            },
            home: {
              handler: function (params) {
                  // fetch home page data...
                  return {  
                    // data + options
                  }; 
                }
              }
            }
          });

        });


  6) Add your routes

        mySpa.addRoutes([        
          { url: '^/product/[0-9]+$', controller: 'product',    action: 'show'  }, // highest priority on the top...
          { url: '^/?$',              controller: 'collection', action: 'index' }  // ...last route is always root - lowest priority, url can be excluded
        ]);


  7) Define templates including the 404 page if you wish.

      <script type="text/html" id="spa__home">
        <h1>{{product.title}}</h1>
      </script>

      <script type="text/html" id="spa__product">
        <h1>{{product.title}}</h1>
      </script>

      <script type="text/html" id="spa__404">
        <h1>Page not found!</h1>
      </script>


  8) Run and pull the cork out!

        mySpa.run();



Custom Actions
---------------


TODO
-----
  * tests