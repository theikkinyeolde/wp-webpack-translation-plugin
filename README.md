# WP Webpack translation plugin

## Requirements

* webpack
* gettext

## Installation

    npm i wp-webpack-translation-plugin

## Usage

You need to require the plugin in the `webpack.config.js` like so:

    const WpTranslationPlugin = require('wp-webpack-translation-plugin');

And add this to the `plugins` array of the configuration:

    new WpTranslationPlugin({
        domain   : '[your language domain name]',
        phpDirectories: [
            '[path to theme]/**/*.php'
        ],
        languagesDirectory : '[directory where the .pot, .po and .mo files reside]'
    })

