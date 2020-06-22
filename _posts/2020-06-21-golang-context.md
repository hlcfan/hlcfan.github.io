---
layout: post
title: "6 questions about golang Context"
date: 2020-06-20 15:05
comments: true
categories: tech
---

Context is a very important component, if you write Golang, you can see it every
where, within a Request, DB query, outgoing call, Goroutine .etc. Almost
every where when there're side effects. We can use Context to cancel operation,
cancel operation before deadline, cancel operation with timeout, or carry some
request scoped data, like current user, tracing data .etc.

Have you ever been inquisitive when using Context? I have.

### What's the difference between `TODO()` and `Background()`?

According to official docs

https://golang.org/pkg/context/#Background
> Background returns a non-nil, empty Context. It is never canceled, has no
> values, and has no deadline. It is typically used by the main function,
> initialization, and tests, and as the top-level Context for incoming requests.

https://golang.org/pkg/context/#TODO
> TODO returns a non-nil, empty Context. Code should use context.TODO when it's
> unclear which Context to use or it is not yet available (because the
> surrounding function has not yet been extended to accept a Context parameter).

They both claim they return empty Context, but are they any different from each
other? Let's check the source code.

```golang
var (
	background = new(emptyCtx)
	todo       = new(emptyCtx)
)

// Background returns a non-nil, empty Context. It is never canceled, has no
// values, and has no deadline. It is typically used by the main function,
// initialization, and tests, and as the top-level Context for incoming
// requests.
func Background() Context {
	return background
}

// TODO returns a non-nil, empty Context. Code should use context.TODO when
// it's unclear which Context to use or it is not yet available (because the
// surrounding function has not yet been extended to accept a Context
// parameter).
func TODO() Context {
	return todo
}
```

Okay, they're no different from implementation, only the context of where
they should be used.

### Why Context can be passed along?

Take a look at following example

```golang
ctx, cancel := context.WithDeadline(parent, time.Now().Add(100*time.Millisecond))
defer cancel()

db.QueryContext(ctx, stmt, args...)
```

We create new Context with timeout and pass it to `QueryContext`, when timeout,
it cancels the operation. Let's dissect `WithDeadline`.

```golang
// A cancelCtx can be canceled. When canceled, it also cancels any children
// that implement canceler.
type cancelCtx struct {
	Context

	mu       sync.Mutex            // protects following fields
	done     chan struct{}         // created lazily, closed by first cancel call
	children map[canceler]struct{} // set to nil by the first cancel call
	err      error                 // set to non-nil by the first cancel call
}
```

From `cancelCtx` we know it persists the children in `children` map.

```golang
func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
  ...
	c := &timerCtx{
		cancelCtx: newCancelCtx(parent),
		deadline:  d,
	}
	propagateCancel(parent, c)
  ...
}

func propagateCancel(parent Context, child canceler) {
  ...
	if p, ok := parentCancelCtx(parent); ok {
		p.mu.Lock()
		if p.err != nil {
			// parent has already been canceled
			child.cancel(false, p.err)
		} else {
			if p.children == nil {
				p.children = make(map[canceler]struct{})
			}
			p.children[child] = struct{}{}
		}
		p.mu.Unlock()
	} else {
    ...
	}

}
```

`p, ok := parentCancelCtx(parent)` returns the `cancelCtx` of parent context.
The next 7th line creates a new `children` if `children` is empty, then insert
the child into the `children` map.

### What's the rationale behind timeout/deadline?

First, `WithTimeout` returns `WithDeadline`, more like a shortcut for easy use.

```golang
func WithTimeout(parent Context, timeout time.Duration) (Context, CancelFunc) {
	return WithDeadline(parent, time.Now().Add(timeout))
}
```

```golang
func WithDeadline(parent Context, d time.Time) (Context, CancelFunc) {
  ...
	c := &timerCtx{
		cancelCtx: newCancelCtx(parent),
		deadline:  d,
	}
  ...
	if c.err == nil {
		c.timer = time.AfterFunc(dur, func() {
			c.cancel(true, DeadlineExceeded)
		})
	}
	return c, func() { c.cancel(true, Canceled) }
}
```

Easy to notice it utilize `time.AfterFunc` under the hood, after certain time
duration, it triggers the execution of cancellation.

### How operation is canceled?

Let's revisit `cancel(removeFromParent bool, err error)`.

```golang
// closedchan is a reusable closed channel.
var closedchan = make(chan struct{})

func init() {
	close(closedchan)
}

func (c *cancelCtx) cancel(removeFromParent bool, err error) {
  ...
	c.err = err
	if c.done == nil {
		c.done = closedchan
	} else {
		close(c.done)
	}
  ...
}
```

When we call `defer cancel()`, it actually calls above function. In the
function, it just closes the `done` channel or assign a closed one to it. Then
we know it's time to stop the operation. Excerpt a few lines from
https://golang.org/src/database/sql/sql.go.

```golang
// Runs in a separate goroutine, opens new connections when requested.
func (db *DB) connectionOpener(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-db.openerCh:
			db.openNewConnection(ctx)
		}
	}
}
```

At line 4, if operation times out, `c.done` is closed, then in subsequent calls,
`ctx.Done` is unblocked, then that corresponding branch will be executed. In
this case, it directly exit the function.

### Will it cancel all children operations if I cancel parent context?

Yes, from above code snippet, you probably have the sense of it. Let's read rest
of `cancel(removeFromParent bool, err error)`.

```golang
func (c *cancelCtx) cancel(removeFromParent bool, err error) {
  ...
	if c.done == nil {
		c.done = closedchan
	} else {
		close(c.done)
	}
	for child := range c.children {
		// NOTE: acquiring the child's lock while holding parent's lock.
		child.cancel(false, err)
	}
	c.children = nil
	c.mu.Unlock()

	if removeFromParent {
		removeChild(c.Context, c)
	}
}
```

After current context is canceled, it'll keep asking its children to cancel the
operations. At 6th line, it iterates all children and send message to each one.
Each of the child will do same as current context does.

### How is scoped data stored?

Key/value can be set by `WithValue(parent Context, key, val interface{}) Context`.

```golang
func WithValue(parent Context, key, val interface{}) Context {
  ...
	return &valueCtx{parent, key, val}
}

type valueCtx struct {
	Context
	key, val interface{}
}

func (c *valueCtx) Value(key interface{}) interface{} {
	if c.key == key {
		return c.val
	}
	return c.Context.Value(key)
}
```

OK, it's a linked list (reverse linked list) you'll see. Current
node points to its parent. Actually all types of contexts, the underlying data
structure is a reverse linked list, like `WithDeadline`, `WithTimeout`, `WithValue`.

### Thoughts?

+ Why use linked list?
+ What's the downside of using linked list?
+ Why `Context` is used to manage both life cycle and scoped data? Is this a good
idea?

### Conclusion

`Context` in Golang has three kinds of internal data type `emptyCtx`, `cancelCtx`,
`valueCtx`, they serve different purposes and they all implement interface
`Context`. `cancelCtx` derives new context and stores them as children, use
`time.AfterFunc` to cancel an operation. Whereas, `valueCtx` derives new context
and stores key/value pair on the new context object.

