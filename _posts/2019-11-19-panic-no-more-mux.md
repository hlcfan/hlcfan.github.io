---
layout: post
title: "Panic no more, Mux"
date: 2019-11-19 20:59
comments: true
categories: tech
---

In last article [Collect Mux metrics](/mux-metrics.html). I wrote about how to
collect metrics data in a middleware. This article I'll write about how to
recover from panic in a middleware using Mux.

In the web framework, like Gin, Rails, Tornado, whenever there's an internal
server error, the framework will catch the error and render the internal server
error from top level. But if you're using Mux, it's not built-in natively, so if
the app crashes internally, it'll not raise a 500 error and sometimes return
error `405 Method Not Allowed`. Hoever Mux does come with this feature, it's in
[https://github.com/gorilla/handlers](https://github.com/gorilla/handlers).
We'll need to enable this before using it.

The package has this function called `RecoveryHandler`, let's utilize this
function to recover from panic. First, we need to create the middleware

``` golang
// RecoveryMiddleware is the rescue to panic
type RecoveryMiddleware struct {
}

// Middleware recovers from panic
func (middleware *RecoveryMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next = handlers.RecoveryHandler()(next)
		next.ServeHTTP(w, r)
	})
}
 ```

Then we can apply this middleware
```golang
router := mux.NewRouter().
recoveryMiddleware := RecoveryMiddleware{}
router.Use(recoveryMiddleware.Middleware)
```

How do we test this middleware? The fisrt question is how to test panic? Here's
what `recover` come to play. Recover is a built-in function that regains control
of a panicking goroutine, and it is only useful inside deferred functions. So
the test would be like
```golang
It("Panics without the middleware", func() {
    req := httptest.NewRequest("GET", "/test", nil)
    w := httptest.NewRecorder()
    defer func() {
        if r := recover(); r != nil {
            fmt.Println("Recovered from panic", r)
        }
    }()
    http.HandlerFunc(handler).ServeHTTP(w, req)

    log.Fatal("No panic")
})
```

