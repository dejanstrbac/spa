*SPA*
=====
a simple micro-framework for single page apps (SPA)
---------------------------------------------------

### Introduction

SPA is a micro-framework built around jQuery (or zepto) that aids building client browsing-heavy (read-heavy) javascript apps, that have no need for continous communication with the server.

SPA is not the universal solution to single page applications, but only one take based on the problem I encountered. The source code of SPA is very small and heavily documented. Depending on your requirements, it might be well worth assembling your own library, and you are welcome to reuse whole or just pieces from SPA.

The benefits of SPA are:

- Faster response time as all the data is already loaded at the clients browser. It is expected that you would send your page compressed (gzip-ed) to the browser - text data can be highly compressed. Particularly useful for catalogue like website.

- Offset browsing hits to the client's hardware.

- Detach the frontend from the backend with another JSON-friendly database like MongoDB in between.

- SPA can use currently available bandwidth to load images in the background for instant viewing. This can be particularly needed on mobile devices that have interrupted connectivity.

Please note that SPA is not a replacement for [backbone.js](http://backbonejs.org) or [spine.js](http://spinejs.com), as it does not (intentionally) follow the MVC pattern strictly:

- There are no models in SPA, as SPA expects a JSON payload to be passed from the server, most likely embedded in the html page. You can ofcourse write your own models if needed, but SPA will not force you to do that.

- Controllers are in charge of extracting data from the JSON payload (possibly also memoizing it) and passing the results onto the views. For extracting of the data, it is recommended to use a library such as [underscore.js](http://underscorejs.org)

- Views are rendered via the simple built-in renderer, but it is advisable to plug-in own renderer function that accepts JSON. The templating library [Mustache.js](https://github.com/janl/mustache.js) is highly recommended.

### Requirements
- [jQuery](http://jquery.com) or [Zepto](http://zeptojs.com) javascript library.

### Restrictions

- SPA uses the location hash to identify and route actions. This means that you cannot have another javascript dependency (as in another javscript library) that uses the location hash. You could overcome this, but not without a 5 pound hammer, so I guess SPA is not for you.

- SPA is for building javascript apps. It will obviously not work where javascript support is turned off.

### Browser Support

- SPA uses the `onHashChange` event to route actions. However, some browsers do not support this event, so there is a polling fallback that will check for hash changes every ~300 milliseconds.

- SPA should be working correctly in all major browsers, including Internet Explorer from version 6 and up. If you find an issue in your browser, please be kind to report either as a github issue or directly to me at [dejan.strbac@gmail.com](mailto:dejan.strbac@gmail.com).


### Source Code
The annotated source code is available at [http://dejanstrbac.github.com/spa](http://dejanstrbac.github.com/spa) 
Improvement suggestions are highly welcome.


### Testing
A simple integration self-test is included in the repo. It will test the core functionalities as a SPA app itself.

### Real World Usage
SPA is currently used at:

  - [DeinDeal.ch](http://home.deindeal.ch)

### Installation
Include the spa.js library in your pages, after including all the dependencies (jQuery/Zepto/Underscore/Mustache etc.), and you can start writing your SPA app.

### Quickstart
TODO

### Licence
Copyright (c) 2012, Dejan Strbac
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: 

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.