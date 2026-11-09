export default {
  name: "open",
  desc: "open the real post page",
  run(ctx, args) {
    const post = args[0] && ctx.fs.postFor(ctx.fs.resolve(ctx.cwd(), args[0]));
    if (!post) return { err: "open: not a post" };
    ctx.navigate(post.url);
    return { out: `opening ${post.url}` };
  },
};
