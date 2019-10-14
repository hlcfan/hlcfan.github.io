---
layout: post
title: "Collect Mux metrics"
date: 2019-10-14 18:18
comments: true
categories: tech
---

Mux is a great routing library for building API apps. I was hoping these web
frameworks would implement the notification machinism, for instrumenting our
apps, like HTTP request duration, DB transactions, Redis operations, by a
protocol. Yet, this is somehow controversial.

In this article, we'll only collect HTTP request duration and status code. Once
we have the data, we can send it to Prometheus or Datadog. Since I'm using mux,
the idea is to implement a middleware to intercept the info for us. A simple
middleware looks like this:

``` go
func metricMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Do stuff here
        log.Println(r.RequestURI)
        // Call the next handler, which can be another middleware in the chain, or the final handler.
        next.ServeHTTP(w, r)
    })
}
```

A middleware is a wrapper wraps a `http.Handler` and return a `http.Handler`.
Within the wrapping process, we can get what we want.

### HTTP request duration

To get HTTP request duration is easy, we just capture the time before the actual
HTTP call and calculate the duration after the call. But only have the duration
doesn't mean anything, we'll also need to know which function costs how much
time. Since we use Mux here, it has this function `func (r *Router) Match(req *http.Request, match *RouteMatch) bool`
[https://github.com/gorilla/mux/blob/v1.7.3/mux.go#L138](https://github.com/gorilla/mux/blob/v1.7.3/mux.go#L138),
from which we can get the corresponding route based on `http.Request`. Let's
extend our function a bit.

``` go
func metricMiddleware(router *mux.Router, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        now := time.Now().UTC()
        // Call the next handler, which can be another middleware in the chain, or the final handler.
        next.ServeHTTP(w, r)
        duration := time.Since(now)
        var match mux.RouteMatch
        go func(duration time.Duration) {
            if router.Match(r, &match) {
                routeName := match.Route.GetName()
                fmt.Println("Route: ", routeName, "Duration: ", duration)
            }
        }(duration)
    })
}
```

Now we know which handler function costs how much time, and we put it in a
Goroutine, so it'll just run lonely there.

### HTTP status

To get HTTP status, we'll need to implement our own `ResponseWriter`, see [https://golang.org/pkg/net/http/#ResponseWriter](https://golang.org/pkg/net/http/#ResponseWriter)

``` go
// customResponseWriter is used for getting the response status
type customResponseWriter struct {
	http.ResponseWriter
	status int
	length int
}

// WriteHeader implements the interface
func (w *customResponseWriter) WriteHeader(status int) {
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

// Write implements the interface
func (w *customResponseWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = 200
	}
	n, err := w.ResponseWriter.Write(b)
	w.length += n
	return n, err
}

func metricMiddleware(router *mux.Router, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        now := time.Now().UTC()
        writer := customResponseWriter{ResponseWriter: w}
        // Call the next handler, which can be another middleware in the chain, or the final handler.
        next.ServeHTTP(w, &writer)
        duration := time.Since(now)
        var match mux.RouteMatch
        go func(duration time.Duration) {
            if router.Match(r, &match) {
                routeName := match.Route.GetName()
                fmt.Println("Route: ", routeName, "Duration: ", duration)
            }
        }(duration)

        go func(httpStatus int) {
            fmt.Println("Reponse status: ", httpStatus)
        }(writer.status)
    })
}
```

Through our customized `ResponseWriter`, we're able to extract the info we need.
Yay.

### Recap

We can get not only HTTP request duration and response status, but also other
information, like User Agent, query parameters.etc. Think furthur, maybe we can
also capture the error trace stack from here, if internal server error. Or even
furthur, we can inject metrics into `Context` and collect them from the
middleware, which is convenient, instead of scatterring probes code in our
codebase. Sure Opentelemetry works with this perfectly. Middleware is a powerful
machinism, use it properly help make code easy to maintain.

I prefer the "Instrumentation API" way, so that we'll only need the listener to
listen on the notifiations/events.

