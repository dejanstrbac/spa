*SPA* - a simple, micro-framework for single page apps
------------------------------------------------------

# Introduction
SPA is a micro-framework that aids building client browsing-heavy (read-heavy) javascript apps, that have no need for continous communication with the server. It expects that the server sends a single page with a JSON payload embedded into the page as a variable, from which it serves the site content:

    var spaPayload = {
      products: [/* lots of data */]
    };

SPA is not the universal solution to single page applications, but only one take based on the problem I encountered. The source code of SPA is very small and heavily documented. Depending on your requirements, it might be well worth assembling your own library, and you are welcome to reuse whatever you can from SPA.

The benefits of SPA apps are:

- Faster responsivness as all the data is already loaded at the clients browser. It is expected that you would send your page compressed (gzip-ed) to the browser - text data can be highly compressed. Particularly useful for catalogue-like websites.

- Offsetting of browsing hits to the client's hardware.

- Possibility to detached frontend from the backend with a JSON-friendly database like MongoDB in between.

- Paths and images preloading; SPA can use currently available bandwidth to load images in the background for instant viewing. This can be particularly needed on mobile devices that have interrupted connectivity.

Please note that SPA is not a replacement for [backbone.js](http://backbonejs.org) or [spine.js](http://spinejs.com), as it does not (intentionally) follow the MVC pattern strictly:

- There are no models in SPA, as SPA expects a JSON payload to be passed from the server, most likely embedded in the html page. You can ofcourse write your own models if needed, but SPA will not force you to do that.

- Controllers are in charge of extracting data from the JSON payload (possibly also memoizing it) and passing the results onto the views. For extracting of the data, it is recommended to use a library such as [underscore.js](http://underscorejs.org)

- Views are rendered via the simple built-in renderer, but it is advisable to plug-in own temlating engine. The templating library [Hogan.js](http://twitter.github.io/hogan.js/) is highly recommended.


### Dependencies
- None.


### Restrictions
- SPA uses the location hash to identify and route actions. This means that you cannot have another javascript dependency (as in another javscript library) that uses the location hash. You could overcome this, but not without a 5 pound hammer, so I guess SPA is not for you.

- SPA is for building javascript apps. It will obviously not work when browser javascript support is off.


### Browser Support
- SPA uses the `onHashChange` event to route actions. However, some browsers do not support this event, so there is a polling fallback that will check for hash changes every ~300 milliseconds.

- SPA should be working correctly in all major browsers, including Internet Explorer from version 6 and up. If you find an issue in your browser, please be kind to report either as a github issue or directly to me at [dejan.strbac@gmail.com](mailto:dejan.strbac@gmail.com).


### Source Code
The annotated source code is available at [http://dejanstrbac.github.io/spa/docs/spa](http://dejanstrbac.github.io/spa/docs/spa)

Improvement suggestions are highly welcome.


### Real World Usage
SPA is currently used at:

- [DeinDeal.ch](http://home.deindeal.ch)


# Quickstart
Include the spa.js library in your pages, after including all the dependencies (jQuery/Zepto/Underscore/Mustache etc.).

    <script type="text/javascript" src="spa.js"></script>

Define your Spa app object (call it as you wish) in a container. If you intend to expose the interfaces to SPA, leave this variable in the global namespace.


    <script type="text/javascript">
      var spaApp = Spa();
    </script>


You should now define your routes. Spa has its paths in the location hash, and they look like `#!/product/1`. Everything after the `#!` is the path that will be passed on to the router for regex matching.

Spa routes propagate to the last one which is by default the root route. When matched, the defined controller and action are being executed. If no action is specified, name `handler` will be implied.


    spaApp.addRoutes([
      { url: '^/collection/[0-9]+/product/[0-9]+$', controller: 'product',      action: 'show'  },
      { url: '^/collection/[0-9]+$',                controller: 'collection',   action: 'show'  },
      { url: '^/?$',                                controller: 'root' }
    ]);


Now you need to add the controllers based on those routes. Controllers are methods which get as an argument the request object from the router. From that request they generate and return a response object to the view.


      spaApp.addRoutes([
        { url: '^/collection/[0-9]+$', controller: 'collection', action: 'show' },
        { url: '^/?$',                 controller: 'root' }
      ]);

      spaApp.addControllers({

        root: {
          handler: function(request) {
            // `request.params`     will contain the params of the action, as collection=1
            // `request.controller` will contain the controller name
            // `request.action`     will contain the name of the action, this method
            //
            // insert your handler code here....
            //
            return {
              data:    {},     // the data you want passed on to the view
              options: {}      // define here the view options
            };
          }
        },

        collection: {
          show: function(request) {
            //
            // insert your handler code here....
            //
            return {
              data:    {},     // the data you want passed on to the view
              options: {}      // define here the view options
            };
          }
        }

      });


To run this app, after adding routes and controllers you just need to call the `start()` method on the app object:


      spaApp.start();


## Rendering Action Results
Template names are assumed based on the controller and action name. In the head of the HTML, you should define all templates, with the conventions of `"spa__" + controller + "__" + action` name.

The following template would be rendered for the action `index` in the controller `collection`:

    <head>
      <!-- other code here -->

      <script type="text/html" id="spa__collection__index">
        <b>template content here in HTML or any templating language</b>
      </script>

    </head>

You _shouldn't put javascript code_ in the templates, even if by some miracle it happens to work. Use callbacks instead, described further below for all post rendering activities you might need.

All templates are memoized at load time. If you need to fetch a template from your code, spa exposes a helper method to fetch a memoized template `helpers.getTemplate(templateName)`. This might come in handy if you work with active partials.


### Rendering Nothing
In some cases your controller action might not need a view. To avoid rendering a template, just set the `renderNothing` variable to `true` in the options object of the response.

    return {
      data: {},
      options: {
        renderNothing: true
      }
    }


### Redirecting
Sometimes you might want to redirect to another path, especially if you have actions which don't render anything as above. To do so, just add the `redirectTo` variable in the options object of the response, setting the destination path as value:

    return {
      data: {},
      options: {
        renderNothing: true,
        redirectTo: '/'
      }
    }

Note however that the destination should be a relative path for the spa app, a spa path, without the prefix '#!'.


## Helpers
If you need to isolate some common functions used between controllers, you can add them to the helpers and call them from the controllers as `spaApp.helpers.myMethod()`. You can define this anywhere before running the app.

    spaApp.addHelpers({

      myMethod: function(key) {
        // do something
      },

      mySecondMethod: function() {
      }

    });

###


## Callbacks
Spa supports callbacks: `beforeFilter`, `afterFilter`, `beforeRender` and  `afterRender`. These can be defined on two levels - in the controller, just as actions, called around the actions of that controller only, or on the global level for all controller actions. A controller specific callback executes before the global one.

    /*
     *  Controller Callbacks
     */
    spaApp.addControllers({

        root: {
          someAction: function(request) {
            // action handler logic
          },

          beforeFilter: function(request) {
            // will execute before all actions in this controller
          },

          afterFilter:  function(request, response) {
            // will execute for all actions in this controller, after the action,
            // regardless of the response
          },

          beforeRender: function(request, response) {
            // will execute for all actions in this controller, after the action,
            // before rendering, if rendering response
          },

          afterRender:  function(request, response) {
            // will execute for all actions in this controller, after the rendering
          },

          beforeUnload: function(request, response) {
            // will execute before next the action is executed
          }

        }

      });


      /*
       *  Global Callbacks
       */
      spaApp.addCallbacks({
        beforeFilter: function(request) {
          // will execute for all actions in all controllers, before the actions
        },

        afterFilter: function(request, response) {
          // will execute for all actions in all controllers, after the actions,
          // regardless of the response
        },

        beforeRender: function(request, response) {
          // will execute for all actions in all controllers, after the actions,
          // before rendering, if rendering response
        },

        afterRender: function(request, response) {
          // will execute for all actions in all controllers, after rendering
        },

        beforeUnload: function(request, response) {
          // will execute before next the action is executed
        }
      });


If you want a callback to execute selectively per action, test the `request.action` variable:

    afterRender: function(request, response) {
      if (request.action === 'show') {
        // will execute for the show action only
      }
    }


## Shorthand Declaration
The shorthand declaration is helpful if you have just a few items to define. The methods `addControllers`, `addHelpers`, `addCallbacks`, `addRoutes` called after this shorthend declaration will extend the objects given before, but _not replace_ them.

      var spaApp = Spa({
        debug: true,
        controllers: {
          // your controllers here
        },
        helpers: {
          // your helpers here
        },
        callbacks: {
          // global callbacks here
        },
        routes: [
          // routes here
        ]
      });



## Memoizing
Spa uses memoization extensively, and it exposes its internal mechanism via public helper `helpers.cache.memoize(bucket, key, getterFunc, useMemo, conditionalFunc)` for possible usage in controllers and helpers.

See this example of a helper that searches for a product in the payload named `spaPayload` via the [Underscore.js](http://underscorejs.org) library, and memoizes the result so further requests are not evaluating the costly search operation:

    getProductById: function(id, useMemo) {
      return spaApp.helpers.cache.memoize('product', id, function(pId) {
        return _(spaPayload.products).find(function(el) { return el.id === +pId; });
      }, useMemo);
    }

If you have no need for such granularity and just need to memoize the controller's action response, you can set the `options.cache` variable to true in the response itself. This will memoize both the response of the controller as well the rendered view, so none will have to execute again.

Of course, we could have skipped the controller action and flow directly to the rendered view, but then the response data object would have not been available in the view, which might be needed for callbacks and other wirings you might have in the code.

    spaApp.addControllers({
      collection: {
        index: function(request) {
          // action body here...
          return {
            data: {
              // the data to be passed to the view/template...
            },
            options: {
              cache: true  // when present and set to true, response and view will be memoized
            }
          };
        }
      }
    });


## Debugging
To enable debugging, simply call `setDebug(true)` on the spa object, or pass `debug: true` in the arguments object when initializing Spa. You will see the logs in the console, taken your browser supports it.


## MIT Licence

Copyright (c) 2014, Dejan Strbac

All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
