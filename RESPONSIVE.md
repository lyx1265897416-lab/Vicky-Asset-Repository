# 双端适配维护要求

用户要求资产库及以后新增的内容始终支持手机和电脑。所有分类（含视频样例）、新增卡片、筛选、素材详情、音频播放器、分享和下载入口均须沿用响应式布局。

共享入口是 gallery-responsive.css 和 gallery-responsive.js，构建模板 build_gallery.py 保持 CSS 最后加载；不要在素材或某一批次里写固定页面宽度。长名称允许换行，图片保持 contain，手机音频列表单列，按钮触控区域至少 44px，手机输入字号至少 16px。不得禁止浏览器缩放。

本地构建与线上 Worker 使用同一适配层。修改后运行 python3 tools/sync_private_ui.py，再运行 python3 tools/check_responsive_ui.py。prepare_private_export.py 也会同步并检查。线上 Worker 将适配层注入每个首页响应，后续更新 R2 素材目录不需要重复补手机样式；修改适配层本身则重新构建发布 Worker。

每次更新资产或页面后，发布前在浏览器检查 320、390/430、768、1440 像素宽，以及 844×390 手机横屏。各类列表不得撑出页面；检查长标题、分类横滑及当前分类可见、编号搜索、无结果、筛选面板、批量选择、图片切换、角色跳转、收藏、音色/BGM播放器和分享弹窗。图片预览在手机竖屏上下排列、横屏左右排列，保留正常滚动与关闭入口。截图与结果保存于 verification/ 当次目录。

自动检查仅保证入口和共享样式一致，不代替真实浏览器走查。桌面浏览器尺寸模拟不等同于真机 Safari/Android 验证；若未做真机测试，交付应说明。

线上导出由 tools/compact_gallery_export.py 将图片的完整生成记录拆到 metadata/details/，首页仅保留列表与筛选需要的摘要。gallery-lazy-details.js 在打开详情时读取对应记录；加载失败可重试，切图后迟到的响应不得覆盖当前角色，复制按钮只在完整记录加载成功后启用。修改时运行 node tools/check_lazy_details.mjs，并在浏览器检查详情、切图和复制按钮。完整 gallery-manifest.json 与记录下载保持可用。

tools/prepare_standalone_site.py 为每个内容版本生成 deployment/standalone-<release>/public/，避免下一次更新夹带已移除资产。独立导出不依赖 chatgpt.site；生成目录不等于已部署，必须完成新托管入口与手机实际网络的验证。

访问范围仅按用户明确要求变更，页面更新本身不得改变。2026-10-17 用户已要求临时启用获得链接即可查看；日后要求锁回时恢复 custom 白名单，保护全部网页和素材。不要为测试公开 R2。
