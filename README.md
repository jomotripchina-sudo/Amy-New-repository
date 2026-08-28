# AMZ 运营工作台前台

这是阶段 7 的静态前台仓库，部署目标为 GitHub Pages。“关键词作战”是当前接入的首个运营模块。

## 页面

- `index.html`：登录与申请使用
- `tool/`：ASIN、广告报表上传和任务列表
- `report/`：登录校验后在线读取并渲染作战报告
- `admin/`：仅唯一审批管理员可访问的使用申请审批表

## 安全边界

- 前台只包含 Supabase Project URL 和公开钥匙。
- Supabase 私钥、SSH、OSS、豆包和西柚密钥不得进入本仓库。
- 报告在沙箱 iframe 中渲染，页面不直接跳转 OSS 地址。

本地配置由工作区外层的 `stage7_write_public_config.ps1` 从《密钥库.md》生成；部署前必须再次执行密钥扫描。
