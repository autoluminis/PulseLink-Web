# PulseLink 官方网站

此目录包含公开官网、使用手册、通知 SDK 和官方插件目录页面；不包含 PulseLink 应用源码、私钥、令牌、客户数据或部署凭据。

## 本地查看与验证

在仓库根目录启动静态服务器：

```sh
python3 -m http.server 8000 --directory website
```

打开 `http://localhost:8000`。动态发布信息需要 HTTP 或 HTTPS 访问，不能直接通过 `file://` 打开。

运行基础验证：

```sh
npm ci --prefix website-tests
npm test --prefix website-tests
```

## 公开发布来源

- 首次安装程序由 `https://release.veio.cn/ota/stable/win-x64/latest.setup.json` 提供版本、文件名、大小和 SHA-256；网页仅展示完整安装程序，不提供 OTA 更新包。
- 通知插件目录从 `https://release.veio.cn/notifications/index.json` 开始读取，并在浏览器中核对各级签名和摘要后再显示下载链接。
- 通知 SDK 与开发指导书由本站 `assets/` 提供。产品内维护、许可证购买和插件信任等操作以产品界面提示及授权交付材料为准，不在官网公开内部导航路径。

## GitHub Pages

`.github/workflows/website.yml` 会在官网相关 PR 中运行检查；合并到 `main` 后，在 Pages 设置为 GitHub Actions 时部署 `website/`。当前公开地址为 `https://autoluminis.github.io/PulseLink-Web/`。

产品能力、正式安装包、插件公钥或官方发行方变更时，应同步对应页面与配置；不要手改已签名的插件目录。
