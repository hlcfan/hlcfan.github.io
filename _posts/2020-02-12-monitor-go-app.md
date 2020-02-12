---
layout: post
title: "What to monitor in golang app"
date: 2020-02-12 10:06
comments: true
categories: tech
---

Recently I mostly work on metrics stuff for a few of our backend services. Since
we move away from NewRelic due to the high pricing ;-). We need to build our own
metrics. We use Prometheus to expose/collect the data and Grafana to display the
data, I'll also list the expression of necessary charts.

### Caveat

The metrics I'm gonna talk about are not universal rules for all the projects,
it varies from individual to individual. If you're seeing some of them indicates
bad metrics and you don't know why, probably you'll need to think about it.

### Response time

This is rather straightforward, faster is always good. Longer response time
makes your service less performant and cause downstream consumers high latency,
no one will be happy about this. Make your service faster.

```
quantile (0.95,  (rate(http_request_duration_seconds_sum{cluster=~"$cluster"}[1m])/rate(http_request_duration_seconds_count{cluster=~"$cluster"}[1m]))) by (path)
```

### Throughput

With throughput, you know how many connections your service is handling in
certain time window. It tells if it needs more resources or if you're
experiencing any request spikes. With HTTP status code, you'll also know if
there's a high error rate.

```
sum(increase(http_request_duration_seconds_count{cluster=~"$cluster"}[1m])) by (code)
```

### Memory

The memory usage for one service varies, normally it shouldn't exceed 1GB,
especially golang is quite memory efficient. Monitor memory usage frequently,
you'll know if you're allocating too many objects or leaking objects. Larger
memory usage could cause longer GC duration.

```
sum(container_memory_usage_bytes{namespace="$namespace",cluster=~"$cluster",pod_name=~"$appname.*"}) by (pod_name)
```

### Goroutines

Goroutines is like threads in OS. By monitoring this, you'll know if app is
under resouce heavy operations. Since context switch for goroutines is low, it's
ok to have many goroutines, however keep an eye on number of goroutines and know
why.

```
go_goroutines{namespace="$namespace",cluster=~"$cluster",service=~"$appname.*"}
```

### GC Pause

GC pause (duration) indicates how long the GC takes. Since GC will stop the
world, keep in mind it shouldn't take longer time. If you see it takes more than
milliseconds, it's not a good signal. Normally microseconds is ok.

```
sum(increase(go_gc_duration_seconds{namespace="$namespace",cluster="$cluster",service=~"$appname.*"}[1m])) by (quantile)
```

### GC Frequency

GC frequency indicates how many GC happens in a certain time frame. GC stops the
world, if too many GC happens, surely your service will get slower somewhat. It
also means you allocate too many objects in stack, consider reducing objects
allocation.

```
sum(increase(go_gc_duration_seconds_count{namespace="$namespace",cluster=~"$cluster",service=~"$appname.*"}[1m])) by (pod)
```
