import { describe, it, expect } from "vitest";
import { detectIntent } from "../intent-router";

describe("Chinese intent patterns", () => {
  describe("undo", () => {
    it.each(["取消", "撤销", "回退", "撤回"])("%s → undo", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "undo" });
    });
  });

  describe("redo", () => {
    it.each(["重做", "恢复"])("%s → redo", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "redo" });
    });
  });

  describe("reverse", () => {
    it.each(["反转", "倒放"])("%s → reverse", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "reverse" });
    });
  });

  describe("loop", () => {
    it.each(["循环", "重复"])("%s → loop seamless", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "loop", mode: "seamless" });
    });
    it.each(["来回", "乒乓"])("%s → loop pingpong", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "loop", mode: "pingpong" });
    });
  });

  describe("fade", () => {
    it("淡入 → fade in", () => {
      expect(detectIntent("淡入")).toMatchObject({ type: "fade", mode: "in" });
    });
    it("淡出 → fade out", () => {
      expect(detectIntent("淡出")).toMatchObject({ type: "fade", mode: "out" });
    });
  });

  describe("shadow & glow", () => {
    it.each(["阴影", "投影"])("%s → shadow drop", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "shadow" });
    });
    it("发光 → glow", () => {
      expect(detectIntent("发光")).toMatchObject({ type: "shadow", options: { type: "glow" } });
    });
  });

  describe("blur", () => {
    it("模糊 → blur in", () => {
      expect(detectIntent("模糊")).toMatchObject({ type: "blur", options: { mode: "in" } });
    });
    it.each(["对焦", "景深"])("%s → blur pulse", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "blur", options: { mode: "pulse" } });
    });
  });

  describe("mirror", () => {
    it.each(["镜像", "水平翻转"])("%s → mirror_h", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "mirror_h" });
    });
    it("垂直翻转 → mirror_v", () => {
      expect(detectIntent("垂直翻转")).toMatchObject({ type: "mirror_v" });
    });
  });

  describe("physics", () => {
    it("弹跳 → bounce", () => {
      expect(detectIntent("弹跳")).toMatchObject({ type: "physics", options: { effect: "bounce" } });
    });
    it.each(["重力", "下落"])("%s → gravity", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "physics", options: { effect: "gravity" } });
    });
    it.each(["摆动", "钟摆"])("%s → pendulum", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "physics", options: { effect: "pendulum" } });
    });
    it.each(["漂浮", "悬浮"])("%s → float", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "physics", options: { effect: "float" } });
    });
  });

  describe("effects", () => {
    it("波浪 → wave", () => {
      expect(detectIntent("波浪")).toMatchObject({ type: "wave" });
    });
    it("抖动 → shake", () => {
      expect(detectIntent("抖动")).toMatchObject({ type: "shake" });
    });
    it("摇摆 → wiggle", () => {
      expect(detectIntent("摇摆")).toMatchObject({ type: "wiggle" });
    });
    it("弹簧 → spring", () => {
      expect(detectIntent("弹簧")).toMatchObject({ type: "spring" });
    });
  });

  describe("particle", () => {
    it.each(["粒子", "闪光"])("%s → sparkle", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "particle", particleType: "sparkle" });
    });
    it.each(["纷飞", "彩纸"])("%s → confetti", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "particle", particleType: "confetti" });
    });
    it.each(["雪", "下雪"])("%s → snow", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "particle", particleType: "snow" });
    });
    it.each(["雨", "下雨"])("%s → rain", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "particle", particleType: "rain" });
    });
  });

  describe("3d & gradient & mask & repeat & trail & draw", () => {
    it.each(["3D", "立体"])("%s → threed", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "threed" });
    });
    it("渐变 → gradient", () => {
      expect(detectIntent("渐变")).toMatchObject({ type: "gradient" });
    });
    it.each(["遮罩", "揭示"])("%s → mask reveal", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "mask", maskType: "reveal" });
    });
    it.each(["阵列", "网格"])("%s → repeat grid", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "repeat" });
    });
    it.each(["拖影", "残影"])("%s → trail", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "trail" });
    });
    it.each(["描边", "绘制"])("%s → draw", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "draw" });
    });
  });

  describe("slide & rotate & scale", () => {
    it("滑入 → slide in", () => {
      expect(detectIntent("滑入")).toMatchObject({ type: "slide" });
    });
    it("滑出 → slide out", () => {
      expect(detectIntent("滑出")).toMatchObject({ type: "slide" });
    });
    it("旋转 → rotate 360", () => {
      expect(detectIntent("旋转")).toMatchObject({ type: "rotate", degrees: 360 });
    });
    it.each(["放大", "变大"])("%s → scale up", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "scale", factor: 1.5 });
    });
    it.each(["缩小", "变小"])("%s → scale down", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "scale", factor: 0.5 });
    });
  });

  describe("utility commands", () => {
    it.each(["优化", "压缩"])("%s → optimize", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "optimize" });
    });
    it("过渡 → transition", () => {
      expect(detectIntent("过渡")).toMatchObject({ type: "transition" });
    });
    it.each(["序列", "连接"])("%s → sequence", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "sequence_list" });
    });
    it("交错 → stagger", () => {
      expect(detectIntent("交错")).toMatchObject({ type: "stagger" });
    });
    it.each(["平滑", "缓动"])("%s → easing", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "easing" });
    });
    it("变形 → morph", () => {
      expect(detectIntent("变形")).toMatchObject({ type: "morph" });
    });
  });

  describe("camera", () => {
    it("放大镜头 → zoom-in", () => {
      expect(detectIntent("放大镜头")).toMatchObject({ type: "camera", movement: "zoom-in" });
    });
    it("缩小镜头 → zoom-out", () => {
      expect(detectIntent("缩小镜头")).toMatchObject({ type: "camera", movement: "zoom-out" });
    });
    it("平移 → pan-left", () => {
      expect(detectIntent("平移")).toMatchObject({ type: "camera", movement: "pan-left" });
    });
  });

  describe("critique & fix & polish", () => {
    it.each(["评审", "分析"])("%s → critique", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "critique" });
    });
    it("修复 → fix", () => {
      expect(detectIntent("修复")).toMatchObject({ type: "fix" });
    });
    it("润色 → polish", () => {
      expect(detectIntent("润色")).toMatchObject({ type: "polish" });
    });
  });

  describe("speed", () => {
    it.each(["加快", "加速"])("%s → speed 2", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "speed", speed: 2 });
    });
    it.each(["减慢", "减速"])("%s → speed 0.5", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "speed", speed: 0.5 });
    });
  });

  describe("color", () => {
    it.each(["暖色", "变暖"])("%s → warm", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "warm" } });
    });
    it.each(["冷色", "变冷"])("%s → cool", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "cool" } });
    });
    it("反色 → invert", () => {
      expect(detectIntent("反色")).toMatchObject({ type: "color", subcommand: { action: "invert" } });
    });
    it("变亮 → brighten", () => {
      expect(detectIntent("变亮")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: 0.2 } });
    });
    it("变暗 → darken", () => {
      expect(detectIntent("变暗")).toMatchObject({ type: "color", subcommand: { action: "brighten", amount: -0.2 } });
    });
    it.each(["饱和", "鲜艳"])("%s → saturate", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: 0.3 } });
    });
    it.each(["去饱和", "暗淡"])("%s → desaturate", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "saturate", amount: -0.3 } });
    });
    it.each(["灰度", "黑白", "单色"])("%s → mono", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "mono" } });
    });
    it.each([
      ["变红", "#ff0000"], ["变蓝", "#0066ff"], ["变绿", "#00cc00"],
      ["变黄", "#ffcc00"], ["变橙", "#ff6600"], ["变粉", "#ff69b4"],
      ["变紫", "#9900cc"], ["变白", "#ffffff"], ["变黑", "#000000"], ["变金", "#ffd700"],
    ])("%s → swap to %s", (msg, hex) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "swap", from: "all", to: hex } });
    });
    it.each(["显示颜色", "调色板"])("%s → palette", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "color", subcommand: { action: "palette" } });
    });
  });

  describe("text", () => {
    it("加文字 hello → text", () => {
      expect(detectIntent("加文字 hello")).toMatchObject({ type: "text", text: "hello", options: {} });
    });
    it("写上欢迎 → text", () => {
      expect(detectIntent("写上欢迎")).toMatchObject({ type: "text", text: "欢迎", options: {} });
    });
    it("添加文字 test → text", () => {
      expect(detectIntent("添加文字 test")).toMatchObject({ type: "text", text: "test", options: {} });
    });
    it("加个标题 hello → text", () => {
      expect(detectIntent("加个标题 hello")).toMatchObject({ type: "text", text: "hello", options: {} });
    });
    it("打字效果 loading → typewriter", () => {
      expect(detectIntent("打字效果 loading")).toMatchObject({ type: "text", text: "loading", options: { style: "typewriter" } });
    });
  });

  describe("style", () => {
    it.each(["霓虹风格", "霓虹"])("%s → style neon", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "neon" });
    });
    it.each(["马卡龙", "粉嫩", "柔和风"])("%s → style pastel", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "pastel" });
    });
    it("单色风格 → style monochrome", () => {
      expect(detectIntent("单色风格")).toMatchObject({ type: "style", style: "monochrome" });
    });
    it.each(["渐变风格", "渐变风"])("%s → style gradient", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "gradient" });
    });
    it.each(["复古风", "复古风格", "怀旧风"])("%s → style retro", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "retro" });
    });
    it.each(["简约风", "极简", "简约风格"])("%s → style minimal", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "minimal" });
    });
    it.each(["大胆风格", "粗犷"])("%s → style bold", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "bold" });
    });
    it.each(["自然风", "自然风格", "大地色"])("%s → style nature", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style", style: "nature" });
    });
    it.each(["风格列表", "有什么风格", "显示风格"])("%s → style_list", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "style_list" });
    });
  });

  describe("help", () => {
    it("帮助 → help", () => {
      expect(detectIntent("帮助")).toMatchObject({ type: "help" });
    });
  });

  describe("play", () => {
    it.each(["播放", "开始播放", "继续播放", "继续"])("%s → play", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "play" });
    });
  });

  describe("pause", () => {
    it.each(["暂停", "停止播放", "停止"])("%s → pause", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "pause" });
    });
  });

  describe("once", () => {
    it.each(["播放一次", "播一次", "不循环", "单次播放"])("%s → once", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "once" });
    });
  });

  describe("random", () => {
    it.each(["随机", "随机动画", "随便来一个"])("%s → random", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "random" });
    });
  });

  describe("a11y", () => {
    it.each(["无障碍检查", "可访问性", "辅助功能检查"])("%s → a11y", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "a11y" });
    });
  });

  describe("fullscreen", () => {
    it.each(["全屏", "最大化"])("%s → fullscreen", (msg) => {
      expect(detectIntent(msg)).toMatchObject({ type: "fullscreen" });
    });
  });

  describe("background", () => {
    it("背景黑色 → background black", () => {
      expect(detectIntent("背景黑色")).toMatchObject({ type: "background", color: "black" });
    });
    it("背景白色 → background white", () => {
      expect(detectIntent("背景白色")).toMatchObject({ type: "background", color: "white" });
    });
    it("背景设为红色 → background red", () => {
      expect(detectIntent("背景设为红色")).toMatchObject({ type: "background", color: "red" });
    });
    it("背景透明 → background transparent", () => {
      expect(detectIntent("背景透明")).toMatchObject({ type: "background", color: "transparent" });
    });
  });

  describe("resize", () => {
    it("调整大小 500x500 → resize", () => {
      expect(detectIntent("调整大小 500x500")).toMatchObject({ type: "resize", width: 500, height: 500 });
    });
    it("尺寸设为 1920x1080 → resize", () => {
      expect(detectIntent("尺寸设为 1920x1080")).toMatchObject({ type: "resize", width: 1920, height: 1080 });
    });
  });

  describe("duplicate_layer", () => {
    it("复制图层 背景 → duplicate_layer", () => {
      expect(detectIntent("复制图层 背景")).toMatchObject({ type: "duplicate_layer", name: "背景" });
    });
    it("克隆图层 Logo → duplicate_layer", () => {
      expect(detectIntent("克隆图层 Logo")).toMatchObject({ type: "duplicate_layer", name: "Logo" });
    });
  });

  describe("delete_layer", () => {
    it("删除图层 背景 → delete_layer", () => {
      expect(detectIntent("删除图层 背景")).toMatchObject({ type: "delete_layer", name: "背景" });
    });
    it("移除图层 Shape → delete_layer", () => {
      expect(detectIntent("移除图层 Shape")).toMatchObject({ type: "delete_layer", name: "Shape" });
    });
  });

  describe("rename_layer", () => {
    it("重命名图层 旧名 为 新名 → rename_layer", () => {
      expect(detectIntent("重命名图层 旧名 为 新名")).toMatchObject({ type: "rename_layer", oldName: "旧名", newName: "新名" });
    });
  });

  describe("variations", () => {
    it.each([
      "给我几个版本",
      "给我几个选择",
      "给我几个方案",
      "换几种风格试试",
      "换几种颜色试试",
      "换几种方式试试",
      "多来几个",
      "其他方案",
      "其他选择",
      "变体",
      "试试不同的",
    ])("%s → variations with empty prompt", (msg) => {
      expect(detectIntent(msg)).toEqual({ type: "variations", prompt: "" });
    });
  });

  describe("export", () => {
    it("matches '导出gif'", () => {
      expect(detectIntent("导出gif")).toEqual({ type: "export_gif" });
    });

    it("matches '保存为gif'", () => {
      expect(detectIntent("保存为gif")).toEqual({ type: "export_gif" });
    });

    it("matches '下载gif'", () => {
      expect(detectIntent("下载gif")).toEqual({ type: "export_gif" });
    });

    it("matches '导出动图'", () => {
      expect(detectIntent("导出动图")).toEqual({ type: "export_gif" });
    });

    it("matches '导出视频'", () => {
      expect(detectIntent("导出视频")).toEqual({ type: "export_video" });
    });

    it("matches '保存为视频'", () => {
      expect(detectIntent("保存为视频")).toEqual({ type: "export_video" });
    });

    it("matches '导出mp4'", () => {
      expect(detectIntent("导出mp4")).toEqual({ type: "export_video" });
    });

    it("matches '下载视频'", () => {
      expect(detectIntent("下载视频")).toEqual({ type: "export_video" });
    });

    it("matches '导出json'", () => {
      expect(detectIntent("导出json")).toEqual({ type: "export_json" });
    });

    it("matches '保存json'", () => {
      expect(detectIntent("保存json")).toEqual({ type: "export_json" });
    });

    it("matches '下载json'", () => {
      expect(detectIntent("下载json")).toEqual({ type: "export_json" });
    });

    it("matches '导出apng'", () => {
      expect(detectIntent("导出apng")).toEqual({ type: "export_apng" });
    });
  });

  describe("multi-intent Chinese connectors", () => {
    it("returns null for messages with Chinese connectors", () => {
      expect(detectIntent("模糊和波浪")).toBeNull();
      expect(detectIntent("模糊然后波浪")).toBeNull();
    });
  });

  describe("creative prompt skip", () => {
    it("returns null for Chinese creative prompts", () => {
      expect(detectIntent("创建一个动画")).toBeNull();
      expect(detectIntent("画一个圆")).toBeNull();
      expect(detectIntent("生成粒子效果")).toBeNull();
      expect(detectIntent("设计一个logo")).toBeNull();
      expect(detectIntent("做一个按钮")).toBeNull();
    });
  });
});
