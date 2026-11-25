// 用 webpack 的 Node API 构建（pnpm 严格布局下 webpack-cli 的 shim 不可用）。
// 这里内联了 webpack.config.js 的配置，但不 require terser-webpack-plugin：
// production 模式本身就带 Terser 压缩。
const path = require('path');
const fs = require('fs');

// 目录按脚本位置推断：本文件在 <workspace>/Majiang/tools/build.js
const root      = path.resolve(__dirname, '..');
const workspace = path.resolve(root, '..');
process.chdir(root);

// 严格布局下 webpack 不在根 node_modules（它只是 webpack-cli 的 peer，
// 只存在于 .pnpm 虚拟仓库里），所以直接从 .pnpm 找。
function resolveWebpack() {
    const tried = [];
    const store = path.join(workspace, 'node_modules', '.pnpm');
    let dirs = [];
    try { dirs = fs.readdirSync(store); } catch (e) { /* ignore */ }
    for (const d of dirs.filter(d => /^webpack@5\./.test(d)).sort().reverse()) {
        const p = path.join(store, d, 'node_modules', 'webpack');
        tried.push(p);
        try { return require(p); } catch (e) { /* next */ }
    }
    tried.push(path.join(root, 'node_modules', 'webpack'));
    try { return require(tried[tried.length - 1]); } catch (e) { /* ignore */ }
    throw new Error('webpack not found, tried:\n' + tried.join('\n'));
}

const version = require(path.join(root, 'package.json')).version;
const webpack = resolveWebpack();

const config = {
    mode: 'production',
    entry: {
        majiang:  './src/js/majiang.js',
        index:    './src/js/index.js',
        autoplay: './src/js/autoplay.js',
        netplay:  './src/js/netplay.js',
        rule:     './src/js/rule.js',
        paipu:    './src/js/paipu.js',
        paili:    './src/js/paili.js',
        hule:     './src/js/hule.js',
        drill:    './src/js/drill.js',
        dapai:    './src/js/dapai.js',
        paiga:    './src/js/paiga.js',
        wenling:  './src/js/wenling.js',
        'wenling-replay': './src/js/wenling-replay.js',
        'wenling-stats':  './src/js/wenling-stats.js',
        ruleset:  './src/js/ruleset.js',
    },
    output: {
        path: path.join(root, 'dist', 'js'),
        filename: `[name]-${version}.js`,
    },
    // pnpm 在 Windows 上用 junction 链接 workspace 包，而 Node/webpack 的 realpath
    // 解析不了这种挂载点，会把同一个 majiang-core 当成两个模块（bundle 里打两份，
    // 且 instanceof 失效）。用 alias 把它们钉到唯一路径。
    resolve: {
        alias: {
            '@kobalab/majiang-core': path.join(workspace, 'majiang-core'),
            '@kobalab/majiang-ai':   path.join(workspace, 'majiang-ai'),
            '@kobalab/majiang-ui':   path.join(workspace, 'majiang-ui'),
            'majiang-wenling':       path.join(workspace, 'majiang-wenling'),
            // majiang-ui 自己 node_modules 里也有一份 jquery。不钉死的话
            // bundle 里会有两份 jQuery（多出 ~84 KiB），插件还会挂到不同实例上。
            'jquery': path.join(root, 'node_modules', 'jquery'),
        },
    },
    optimization: {
        minimizer: ['...'],
    },
};

webpack(config, (err, stats) => {
    if (err) {
        console.error(err.stack || err);
        process.exit(1);
    }
    const info = stats.toJson({ all: false, errors: true, warnings: true });
    if (info.warnings && info.warnings.length)
        console.warn(info.warnings.map(w => w.message).join('\n'));
    if (stats.hasErrors()) {
        console.error(info.errors.map(e => e.message).join('\n'));
        process.exit(1);
    }
    console.log(stats.toString({ colors: false, chunks: false, modules: false }));

    /* 给 HTML 里的 js/css 引用打上构建时间戳，浏览器就不会拿旧文件了 */
    const stamp   = Date.now().toString(36);
    const distDir = path.join(root, 'dist');
    let touched   = 0;
    for (const f of fs.readdirSync(distDir).filter(n => n.endsWith('.html'))) {
        const p = path.join(distDir, f);
        const before = fs.readFileSync(p, 'utf8');
        let after = before.replace(
            /(src|href)="((?:js|css)\/[^"]+?\.(?:js|css))(\?v=[^"]*)?"/g,
            (m, attr, url) => `${attr}="${url}?v=${stamp}"`
        );
        /* 顺便把构建号写进 <meta name="build">，页面上能看到跑的哪一版 */
        if (/<meta name="build"/.test(after))
            after = after.replace(/<meta name="build" content="[^"]*">/, `<meta name="build" content="${stamp}">`);
        else
            after = after.replace(/<head>/i, `<head>\n    <meta name="build" content="${stamp}">`);
        if (after !== before) { fs.writeFileSync(p, after); touched++; }
    }
    console.log(`stamped ${touched} html files with v=${stamp}`);
});
