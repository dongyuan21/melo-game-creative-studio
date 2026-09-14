# v0.1.4 交付说明

> 本文是一期 MVP 交付备忘，不是现行产品说明书。现行能力见 [`README.md`](../README.md)。

## 这次交付是什么

这是一期 Web 闭环的可运行 MVP，不是静态原型。核心路径已经写成代码：

```text
牌面编辑 → 真人/机器试玩 → 语义 Take → 节奏编译 → Three.js 3D 重放
→ 固定时间步逐帧渲染 → WebCodecs H.264 → MP4
```

## Review 建议顺序

1. 先运行 `npm run check`，确认源码结构和纯逻辑核心。
2. 运行 `npm install && npm run dev`，导入 `examples/demo-cross-clear.melo.json`。
3. 检查横纵交叉清除、连续非消除落子、真人拖拽、机器 Take 和四套节奏。
4. 独立切换几何、材质、灯光、摄像机和 3D 清除效果。
5. 最后测试三档 MP4 导出并记录耗时。

## 已做的可靠性处理

- Project/Take 导入不是直接 `JSON.parse` 后信任，而是完整校验并重新执行 Replay。
- Take 初态必须与当前项目初态完全一致；修改牌面、Seed 或候选块后旧 Take 自动失效。
- 指针轨迹只能位于动作时长内，Take ID 和 Action ID 必须唯一。
- H.264 输出尺寸必须为偶数；正式渲染前检查当前 Chrome 是否能编码目标尺寸的 AVC。
- 试玩和渲染期间锁定会污染状态的编辑操作；导出开始时冻结 Project 与 Take 快照。
- 玩法核心不依赖 React、Three.js 或浏览器，可由 Node.js 独立测试。
- DCC 只保留 Provider/Backend 接口，未污染一期项目 Schema。

## 当前环境未验证项

本次生成环境无法连接 npm registry，因此没有安装前端依赖，也没有在这里伪称完成真实 GPU/Chrome/MP4 基准。仓库已经包含 CI、检查脚本和本机 Review 清单；在有网络的开发机执行 `npm install` 后即可完成最终构建与浏览器验收。

## 依赖与离线运行

源代码不使用公共 CDN。首次在联网机器执行 `npm install` 后，依赖保存在本地，之后可离线启动、构建与执行浏览器渲染。交付 ZIP 未内置 `node_modules`。
