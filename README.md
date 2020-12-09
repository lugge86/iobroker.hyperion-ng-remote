![Logo](admin/hyperion-ng-remote.png)
# ioBroker.hyperion-ng-remote

[![NPM version](http://img.shields.io/npm/v/iobroker.hyperion-ng-remote.svg)](https://www.npmjs.com/package/iobroker.hyperion-ng-remote)
[![Downloads](https://img.shields.io/npm/dm/iobroker.hyperion-ng-remote.svg)](https://www.npmjs.com/package/iobroker.hyperion-ng-remote)
![Number of Installations (latest)](http://iobroker.live/badges/hyperion-ng-remote-installed.svg)
![Number of Installations (stable)](http://iobroker.live/badges/hyperion-ng-remote-stable.svg)
[![Dependency Status](https://img.shields.io/david/lugge86/iobroker.hyperion-ng-remote.svg)](https://david-dm.org/lugge86/iobroker.hyperion-ng-remote)
[![Known Vulnerabilities](https://snyk.io/test/github/lugge86/ioBroker.hyperion-ng-remote/badge.svg)](https://snyk.io/test/github/lugge86/ioBroker.hyperion-ng-remote)

[![NPM](https://nodei.co/npm/iobroker.hyperion-ng-remote.png?downloads=true)](https://nodei.co/npm/iobroker.hyperion-ng-remote/)

## hyperion-ng-remote adapter for ioBroker

Remote for hyperion.ng

## Overview

This is hyperion-ng-remote, an adapter for ioBroker to access and control a hyperion.ng server.

<b><span style="color:red">This adapter is still alpha!</span></b>

I started this adapter for accessing my hyperion.ng, running on a Raspberry Pi 3.
The previous adapter only supports classic hyperion and seems to be no longer maintained.

### Features
Currently, only a set of basic features is implemented.
I started developing the adapter with my personal use cases in mind, thus, the feature set might not be what you are expecting.

Currently, the following is supported and tested:
- readout server information and system information
- adding new colors and effects via admin tab
- colors and effects can have a "friendly name" set in addition to their native priority numbers
- activate colors and effects via data points
    - activation by setting the appropriate priority number
    - activation via a priority-specific trigger datapoint
    - activation by setting the "friendly name" of a configured priority

### Roadmap
Developing is ongoing, however, main focus is on stability and reliability instead of throwing in new features.

The following is on the ToDo-List and will be implemented sooner or later. No feature requests are necessary:
- cleanup of admin tab
- using of TCP/IP instead of http for accessing the server
- enable/disable components via datapoints
- advanced effect configuration (change effect-specific parameters)
- "Live-Configurator" for colors and effects in admin tab
- support of the duration parameter of colors and effects which allows a couple of nice applications, e.g. notifications

### Constraints
At the moment, I do not plan to implement full means of configuration capability.
Basic setup of hyperion.ng will always have to be done via the common means, e.g. editing config file or using the web GUI.

Obsolete data points are never deleted at the moment.
When colors or effects are dropped from configuration, related data points can be deleted by hand. 


## Developer manual
This section is intended for the developer. It can be deleted later

### Getting started

You are almost done, only a few steps left:
1. Create a new repository on GitHub with the name `ioBroker.hyperion-ng-remote`
1. Initialize the current folder as a new git repository:  
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    ```
1. Link your local repository with the one on GitHub:  
    ```bash
    git remote add origin https://github.com/lugge86/ioBroker.hyperion-ng-remote
    ```

1. Push all files to the GitHub repo:  
    ```bash
    git push origin master
    ```
1. Head over to [main.js](main.js) and start programming!

### Best Practices
We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`
Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description                                              |
|-------------|----------------------------------------------------------|
| `test:js`   | Executes the tests you defined in `*.test.js` files.     |
| `test:package`    | Ensures your `package.json` and `io-package.json` are valid. |
| `test` | Performs a minimal test run on package files and your tests. |

### Writing tests
When done right, testing code is invaluable, because it gives you the 
confidence to change your code while knowing exactly if and when 
something breaks. A good read on the topic of test-driven development 
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92. 
Although writing tests before the code might seem strange at first, but it has very 
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter
Since you have chosen GitHub Actions as your CI service, you can 
enable automatic releases on npm whenever you push a new git tag that matches the form 
`v<major>.<minor>.<patch>`. The necessary steps are described in `.github/workflows/test-and-release.yml`.

To get your adapter released in ioBroker, please refer to the documentation 
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually on a local ioBroker installation
In order to install the adapter locally without publishing, the following steps are recommended:
1. Create a tarball from your dev directory:  
    ```bash
    npm pack
    ```
1. Upload the resulting file to your ioBroker host
1. Install it locally (The paths are different on Windows):
    ```bash
    cd /opt/iobroker
    npm i /path/to/tarball.tgz
    ```

For later updates, the above procedure is not necessary. Just do the following:
1. Overwrite the changed files in the adapter directory (`/opt/iobroker/node_modules/iobroker.hyperion-ng-remote`)
1. Execute `iobroker upload hyperion-ng-remote` on the ioBroker host

## Changelog

### 0.0.1
* (lugge86) initial release

## License
MIT License

Copyright (c) 2020 lugge86 <lugge@mailbox.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
