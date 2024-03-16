# Uploading, Resizing and Serving images with Google Cloud Platform

Source: https://web.archive.org/web/20211022054117/https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556

Images are displayed on all kind of devices with different resolutions and at different network conditions. In order to do it right we have to deliver the images as fast as possible, with the best available quality, taking into account the targeted device and screen resolution. One option is to create an image service yourself, where you can upload the images, store them and possibly resize them in few different sizes. Unfortunately, doing so is usually very costly in terms of CPU, storage, bandwidth and can end up very pricy. It is also quite a complicated task and many things can go wrong.

By using Google App Engine and Google Cloud Storage though, you can easily achieve this seemingly difficult task by using their API. Start by [completing a simple tutorial](https://cloud.google.com/appengine/docs/legacy/standard/python/blobstore) on how to upload files into the cloud and read the rest if you want to see it in action to understand why it’s one of the coolest things ever.

## The Function
App Engine API has a very useful function to extract a magic URL for serving the images when uploaded into the Cloud Storage: [get_serving_url()](https://cloud.google.com/appengine/docs/legacy/standard/python/refdocs/google.appengine.api.images)

Returns a URL that serves the image in a format that allows dynamic resizing and cropping, so you don’t need to store different image sizes on the server. Images are served with low latency from a highly optimized, cookieless infrastructure.

In practice it’s the same infrastructure that Google is using for their own services like Google Photos. The magic URLs usually have the following form: http://lh3.googleusercontent.com/93u...DQg

## How to use the magic URL
- By default it returns an image of a maximum length of 512px
- By appending the `=sXX` to the end of it where XX can be any integer in the range of 0–2560 and it will result to scale down the image to longest dimension without affecting the original aspect ratio (`http://lh3.goo…aDQg=s256`) - *get_serving_url() docs say max is 1600 - should double-check that.*
- By appending `=sXX-c` a cropped version of that image is being returned as a response (`http://lh3.goo…aDQg=s400-c`)
By appending `=s0` the original image is being returned without any resize or modification (`http://lh3.goo…aDQg=s0`)

There are no charges for resizing the images and caching them when using Google’s magic URL. You pay only for the actual storage of the original image.

## Summary
All you need to do is to upload your images once, extract the magic URL and then use it directly on the client-side by updating the arguments depending on the environment.

## Try it yourself
Besides the already mentioned tutorial from the documentation, you can play with a live example on gae-init-upload (which is based on the open source project [gae-init](https://github.com/gae-init/gae-init)).
