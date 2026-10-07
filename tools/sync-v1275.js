/**
 * Claude Desktop v2.26454.0.0 ➔ claude-chinese v1.2.75 一键同步与词库增量生成器
 */
const fs = require('fs');
const path = require('path');
const { extractVariables, validatePair } = require('./icu-validator');

const repoRoot = path.resolve(__dirname, '..');
const officialEnPath = 'C:\\Program Files\\WindowsApps\\Claude_2.26454.0.0_x64__pzs8sxrjxfjjc\\app\\resources\\en-US.json';
const officialIonEnPath = 'C:\\Program Files\\WindowsApps\\Claude_2.26454.0.0_x64__pzs8sxrjxfjjc\\app\\resources\\ion-dist\\i18n\\en-US.json';
const localEnBasePath = path.join(repoRoot, 'dict/en-US.base.json');
const localZhPath = path.join(repoRoot, 'dict/zh-CN.json');
const ionZhPath = path.join(repoRoot, 'dict/ion-zh-CN.json');

console.log('=== 执行 v1.2.75 增量同步与全量词库校验 ===');

// 1. 同步外壳层 (Shell Layer)
if (fs.existsSync(officialEnPath)) {
  const officialEn = JSON.parse(fs.readFileSync(officialEnPath, 'utf8'));
  const oldBase = JSON.parse(fs.readFileSync(localEnBasePath, 'utf8'));
  const localZh = JSON.parse(fs.readFileSync(localZhPath, 'utf8'));

  // 建立历史英文文本 -> 历史中文翻译映射
  const textToZh = new Map();
  for (const [k, enText] of Object.entries(oldBase)) {
    if (localZh[k]) {
      textToZh.set(enText.trim(), localZh[k]);
    }
  }

  // 15 个全新外壳词条的高质量出版级翻译
  const shellNewTranslations = {
    "+4ABv8PeZM": "允许您的手机和 claude.ai 在此计算机上启动会话？",
    "+FjrzEnF0o": "在 Claude 运行期间，您从手机和 claude.ai 启动的会话可以在您的受信任文件夹中读取和编辑文件以及运行命令。点击以选择文件夹或关闭此功能。",
    "2f4ipR1XJ3": "仅允许一次",
    "CODRKCJ4X9": "您的云端会话可以读取和编辑“Remote Control”下列出的文件夹中的文件，并在此计算机上运行命令。在自动模式下，它们不会每次都询问。这适用于您在此计算机上使用的所有 Claude 账户。",
    "GYzQrgJkqp": "Claude 即将对 {sites} 执行操作。此操作已转交由您决定。",
    "I6c07JLW4E": "始终允许在 {host} 上读取？",
    "JiEEn713iZ": "{count, plural, one {导入会话} other {导入 # 个会话}}",
    "Ql1y4tG1aB": "{count, plural, one {它可能来自终端或其他组织，或者是您已删除的会话。它将保留历史记录和权限模式（绕过权限模式除外），但不会保留归档状态或权限授予。} other {这可能包括来自终端、其他组织以及您已删除的会话。它们将保留历史记录和权限模式（绕过权限模式除外），但不会保留归档状态或权限授予。}}",
    "ZoeAQvufEY": "没有可用的系统密钥环。无法在此计算机上保存您的登录信息、SSH 密码和环境变量，扩展密钥也未加密。请安装并解锁 {keyringName}，然后重启 Claude。",
    "iNs8MbHlPX": "名称 {host} 来自您的局域网，而非公共网络。在另一个网络（如咖啡馆 Wi-Fi）上，不同设备可能会使用相同的名称和地址，而 Claude 会在未经询问的情况下读取其页面。您可以随时在设置中的“允许的网站”下移除此网站。",
    "j4ih4+6F9S": "{count, plural, one {导入 # 个 Claude Code 会话？} other {导入 # 个 Claude Code 会话？}}",
    "r47/+uodLe": "此操作已转交由您决定。",
    "uLIEqJ/LoF": "名称 {host} 来自您的局域网，而非公共网络。在另一个网络（如咖啡馆 Wi-Fi）上，不同设备可能会使用相同的名称和地址，而 Claude 会在未经询问的情况下对其使用浏览器工具。您可以随时在设置中的“允许的网站”下移除此网站。",
    "wK8BQ9r8fA": "始终允许 Claude 访问 {host}？",
    "z7PjA3Mv2T": "始终允许"
  };

  // 构建全新的外壳词库 (完整对齐官方 769 key)
  const newLocalZh = { ...localZh };
  for (const [k, enText] of Object.entries(officialEn)) {
    const enTrim = enText.trim();
    if (shellNewTranslations[k]) {
      newLocalZh[k] = shellNewTranslations[k];
    } else if (textToZh.has(enTrim)) {
      newLocalZh[k] = textToZh.get(enTrim);
    }
  }

  // 严格校验官方全部 769 个 key
  for (const [k, enText] of Object.entries(officialEn)) {
    const zhText = newLocalZh[k];
    if (!zhText) {
      console.error(`Missing shell translation for key [${k}]: ${enText}`);
      process.exit(1);
    }
    const res = validatePair(k, enText, zhText);
    if (!res.valid) {
      console.error(`Shell validation failed for key [${k}]:`, res.errors);
      process.exit(1);
    }
  }

  fs.writeFileSync(localEnBasePath, JSON.stringify(officialEn, null, 2) + '\n', 'utf8');
  fs.writeFileSync(localZhPath, JSON.stringify(newLocalZh, null, 2) + '\n', 'utf8');
  console.log(`✅ 外壳层词典同步就绪 (基线: ${Object.keys(officialEn).length}, 中文: ${Object.keys(newLocalZh).length})`);
}

// 2. 同步 Web UI 核心层 (Ion-Dist Layer)
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

// 2.26454.0.0 核心新增业务词条 (Agents / Environment / Simulator / WSL / Monthly budget / Cowork) + 用户反馈 Git/Cowork 文件夹深度补齐
const webUiNewTranslations = {
  // 核心特性单字与标签
  "+0I7HUJ9U4": "智能体",
  "+2D7UVWVui": "关闭 · 无法启动",
  "+Ht+va/9EY": "月度共享预算",
  "+0DehLdDCf": "已标记为发送给 Claude，但未发送任何内容。请打开该{where, select, session {会话} other {任务}}并在其中询问 Claude。",
  "+9xmJFMi+u": "您经常在 {place} 开始；将其另存为环境，即可在此一键启动",
  "+NHh0bYyxd": "{name} 无法启动：{path} 不再存在。请编辑环境以选择其他文件夹。",
  "+QemIWnPB6": "iOS 模拟器需要完整的 Xcode 应用程序。请从 Mac App Store 安装，然后进行选择。",
  "+qqWWor8HN": "您组织的默认环境不可用。请在 {product} 设置中选择环境，或在下方设置默认环境（{product} 也会使用它）。",
  "+ve5HIdJLG": "将对话和 Cowork 统一为一个体验。",
  "/irxd4uvx/": "模拟器触控界面。点击以聚焦，然后键入以发送按键",
  "/j5fP/x1iw": "环境变量适用于每个本地会话。<link>编辑</link>",
  "/vyAevbknR": "启动一次 Cowork 任务以完成设置，然后重新打开此文件。",
  "/xtcJzrGDc": "您当前的角色已关闭云端 Cowork。如果需要恢复，请咨询您的管理员。",
  "0Cy4NcdHA/": "监控 CI 并审查此例行任务创建的 PR 上的评论，并允许 Claude 推送修复。",
  "0DNgZG3iak": "环境已归档",
  "0VJ03441aq": "Cowork 虚拟机没有响应。",
  "0YGBZfMiKX": "此计划任务由于多次启动失败已被禁用。请检查其环境和设置，然后重新启用。",
  "0cwaeTfMVL": "此规则仅适用于 Anthropic 员工账户，并拒绝过期的 Claude Code 版本，因此重新登录将无济于事。请更新 Claude 桌面应用程序，或更新另一台计算机上的 Claude Code 以进行远程控制会话，然后开始新会话。",

  // 用户实测截图反馈：Diff 对话框统一为“差异”、文件树菜单及 Connectors 导入策略
  "ZSmll0R5ni": "差异需要 Git 仓库",
  "oY/OLoumIq": "未找到与此会话关联的 Git 仓库，或者无法访问其所在文件夹。",
  "EWuoILwvPS": "正在加载差异",
  "Hvf2wzumza": "无法加载差异",
  "QsXVl6P9QX": "无法加载差异。稍后将自动重试。",
  "YPNYZXiGJD": "没有未提交的差异",
  "nM04gPHngB": "没有可显示的差异",
  "+tXqi3Eb5L": "Tab 键缩进",
  "UrQOENubHk": "缩进参考线",
  "n3QqCl2bg7": "制表符宽度",
  "JWDj9FZ3tB": "允许用户从中导入的组织",
  "YIm8r9KgW7": "设置后，用户仅能通过登录导入，且仅限具有这些 ID 的 Claude.ai 组织。",
  "v2GKYTjwD3": "[\"00000000-0000-0000-0000-000000000000\"]",
  "3xPFv/Ldgz": "当您在此设备上信任某个文件夹时，即表示您允许 Claude 使用该文件夹及其内部包含的文件夹。信任文件夹不会将其自动添加到新任务中。当您将文件夹添加到某个任务时，可能会要求您再次允许。",
  "OjVIjFCKAO": "为您的整个组织定义权限、允许的目录等。这将覆盖用户和项目设置，并适用于 CLI、IDE 和桌面应用程序中的 Claude Code。此处设置的市场白名单和黑名单（<code>strictKnownMarketplaces</code>、<code>blockedMarketplaces</code>）也适用于您组织中的任何人在对话、Cowork 或组织设置中从 Git 仓库添加市场的情况。<link>了解更多</link>",
  "kC9u5bkUbz": "只能导入受信任文件夹中的会话，目前没有可添加的会话。",
  "5BMPzic821": "Claude 可以工作的文件夹。适用于 Cowork 和 Code 会话以及对话读取的项目文件夹。留空表示不受限制的访问。",
  "4+I6qVewOt": "当 GitHub 上的仓库发生变更时，自动保持插件为最新状态",
  "6x7ohk20AV": "已连接到 GitHub",
  "6xcHz8hf+d": "GitHub 连接未完成",
  "65iaTQ+eXa": "重新关联 GitHub 以恢复对您仓库的访问权限。",
  "6Ymoec6H2o": "您的 GitHub 登录已失效。请重新连接 GitHub 以继续。",
  "453A6UMfzt": "重新关联 GitHub",
  "3rlJEfT+Tj": "GitLab 实例",
  "5P3agS06r0": "连接 GitLab 实例",
  "/f5Bz9JZC4": "添加 GitHub Enterprise 实例",
  "12CWfaqd+n": "将 GitHub 连接到 Claude 以在此处执行此操作，或直接使用 GitHub。",
  "3zoYYPGhRW": "Cowork 已将这些指令保存在此计算机的文件中，并可能在会话期间对其进行了编辑。添加前请阅读：一旦添加，它们将适用于您的所有对话，您可以在“给 Claude 的指令”下对其进行编辑。如果您添加这些指令，仅保存在另一台计算机上或此计算机上另一组织下的指令将在 Cowork 下次在那里启动会话时被清除。",
  "1WuUqZz7Uo": "{count, plural, one {# 个云端 Cowork 会话} other {# 个云端 Cowork 会话}}"
};

// ICU 与大括号严格校验
if (fs.existsSync(officialIonEnPath)) {
  const officialIonEn = JSON.parse(fs.readFileSync(officialIonEnPath, 'utf8'));
  for (const [k, zhText] of Object.entries(webUiNewTranslations)) {
    const enText = officialIonEn[k];
    if (enText) {
      const res = validatePair(k, enText, zhText);
      if (!res.valid) {
        console.error(`Web UI validation failed for key [${k}]:`, res.errors);
        process.exit(1);
      }
    }
  }
}

Object.assign(ionZh, webUiNewTranslations);
fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2) + '\n', 'utf8');
console.log(`✅ Web UI 核心层词典同步就绪 (总词条数: ${Object.keys(ionZh).length})`);

// 3. 同步长文档 (Long Docs Layer)
const longDocsPath = path.join(__dirname, '../dict/long-docs-zh-CN.json');
const longDocs = JSON.parse(fs.readFileSync(longDocsPath, 'utf8'));
const newDocs = {
  "Beta. The app sends its session API to this endpoint": "Beta 测试版。应用使用配置的凭据向此端点发送会话 API，该配置块的存在会使整个安装变为自托管：不会在设备上运行任何会话，不过设备上的本地 MCP 服务器（个人自身和组织的服务器）仍会在设备上启动并为宿主会话提供服务（内置和远程服务器不会；对于插件的服务器，仅组织插件目录中插件的本地 (stdio) MCP 服务器会提供服务，除非托管服务器同名），其旁边配置的推理供应商将被忽略，并且仅配置设备端会话的每个键（标有 `x-executionTarget: desktop`）将停止生效 —— 该策略属于会话运行的基础架构。凭据改为读取端点的推理凭据键：`inferenceCredentialKind`（`external-idp` 搭配 `inferenceIdpOidc` 和 `inferenceIdpAuthFlow`；`helper-script` 搭配 `inferenceCredentialHelper` 及其子项；`static` 搭配 `selfHostedToken`）。必须为 `https://`（纯 `http://` 仅支持环回主机，从设备管理或本地配置文件中读取；设置服务器不得指定环回主机），且不能带有查询字符串或片段。在未阻止必要遥测的情况下，此安装的崩溃和错误报告可以带有会话在设备外运行的标记，以及描述此端点所提供内容的布尔值和计数。应用按类型（崩溃、错误以及读取设置、登录、连接到本地工具或更新失败）统计其启动和失败次数。如果端点接受，应用会将数字连同固定列表中的词汇、应用版本以及操作系统的名称、版本和处理器一同提交给此端点。这些数字不包含任何消息、名称、路径、地址或 ID。端点可以判断发送方所属的应用。如果您进行了设置，端点会向 Anthropic 的使用报告添加总计数据；其传递的内容不指代任何人。阻止必要遥测将停止统计。",
  "In third-party deployments this also keeps Cowork's workspace image": "在第三方部署中，这还可以防止在使用前提前提取 Cowork 的工作区镜像和工具；这些资源将在任务首次需要时才进行提取。",
  "If unset, the app uses the organization of your Anthropic sign-in": "若未设置，应用将使用您的 Anthropic 登录组织（若连接具有该组织）。否则，遥测将标记为应用从连接设置派生的值。若无法派生，遥测将标记为与其他未配置部署共享的占位符 UUID。在后两种情况下，本地数据将存储在占位符下。**更改此值将导致存储在先前值下的数据（会话、技能、插件）变为孤立数据**。",
  "The path on the user's computer of the signed package your endpoint security (EDR) vendor supplies for the Cowork workspace VM": "端点安全 (EDR) 供应商为 Cowork 工作区虚拟机提供的已签名安装包在用户计算机上的路径。将其签名文件放在此路径所指向的文件旁边，命名为该文件名加上 `.sig`。请将两者及其上层所有文件夹放置在普通用户无法写入的位置。每次工作区虚拟机启动时，都会检查该签名，且仅当签名来自您必须同时设置的 `coworkEDRIntegrationVendor` 中命名的供应商时，才会以 root 权限运行安装包的 `install.sh` 以安装或更新传感器。签名仅涵盖安装包文件（包含 `install.sh`）；传感器随后下载的内容（包括其自身的更新）归供应商所有，Claude 不会对其进行检查。仅限 macOS。\n\nClaude 仅从管理员才能安装的配置中读取此键：macOS 上的 MDM 描述文件，或 Linux 上 `/etc/claude-desktop` 下由 root 拥有的文件。应用在应用内设置面板、用户可编辑的任何文件以及配置服务器中都会忽略此键。它是应用行为键（`disableAutoUpdates`、`relaunchEnforcementHours`、`egressProxyUrl` 等）之一，Claude 将它们作为一个整体来处理：一旦您的描述文件设置了其中任何一个，本地文件或配置服务器中其他键的值将停止生效，因此请将您使用的每个键放在同一个描述文件中。\n\n未设置（默认）：工作区虚拟机中不安装任何供应商安装包。移除此键仅会阻止安装包的后续运行。它不会移除或停止已安装的传感器，该传感器将保留在工作区虚拟机的磁盘上，直到该虚拟机被删除或替换。\n\n网络访问：`install.sh` 及其安装的任何内容均在工作区虚拟机中以 root 身份运行，不属于任何会话，因此网络流出允许列表、代理键（`egressProxyUrl`、`egressProxyPacUrl`）和设备的代理设置不适用于它们。Claude 在其他方面不会限制它们可以访问哪些互联网主机；它们的连接来自设备的常规流量，受您自己的网络层控制。",
  "The ID of the endpoint security (EDR) vendor that signed the package `coworkEDRIntegration` points to": "对 `coworkEDRIntegration` 所指向安装包进行签名的端点安全 (EDR) 供应商 ID：由 a 到 z、0 到 9 以及连字符组成的 1 到 32 个字符，不得以连字符开头，例如 `example-vendor`。它必须是此版本 Claude 接受的 ID；请咨询您的供应商应使用哪个 ID。只要设置了 `coworkEDRIntegration`，此项就是必填项。工作区虚拟机仅在该供应商签名时才运行该安装包；任何其他人签名的安装包都将被拒绝，即使是此版本 Claude 接受的另一家供应商也是如此。虚拟机检查的签名是 `coworkEDRIntegration` 下描述的 `.sig` 文件。仅限 macOS。\n\nClaude 仅从 `coworkEDRIntegration` 下描述的配置中读取此键，并忽略来自其他任何位置的值。它是应用行为键之一（参见 `coworkEDRIntegration`），因此请将其与您使用的所有其他应用行为键放在同一描述文件中。\n\n未设置（默认）：如果设置了 `coworkEDRIntegration`，则不会安装任何内容，并且每次工作区虚拟机启动时，应用日志文件夹中的 `cowork_vm_node.log` 都会记录原因 `vendor_not_named`。对于不符合上述格式的值，它会记录 `config_invalid`；对于此版本 Claude 不接受的 ID，它会记录 `vendor_unknown`；两者都不会安装任何内容。要在没有这些日志条目的情况下关闭此功能，请移除 `coworkEDRIntegration`，而不是此键。移除任一键仅会阻止后续运行：已安装的传感器将保留在工作区虚拟机的磁盘上，直到该虚拟机被删除或替换。",
  "When true, a claude.ai connector's (remote MCP server's) OAuth sign-in started from Claude Desktop": "若为 true，从 Claude Desktop 发起的 claude.ai 连接器（远程 MCP 服务器）OAuth 登录将在系统浏览器中运行并完成，随后重新打开应用的 claude:// 链接仅报告结果。若为 false（默认），在支持在应用内完成登录的帐户上（这是服务端灰度功能，而非此配置中的设置），浏览器仅打开连接器自身的登录页面，应用将自行完成登录。其他 claude:// 链接（对话、项目、Claude Code 会话）不受影响；在第三方部署中，`disableDeepLinkRegistration` 会将其关闭。通过设备管理（MDM 或机器策略）进行设置；它将在应用下次启动时生效，无法读取为 true 或 false 的值将视为 true。这是一个类似于 `disableAutoUpdates` 的应用行为键：设置其中任何一个键的描述文件将成为所有这些键的唯一来源，因此请一起部署；仅设置此类键的描述文件将保留用户其余配置的有效性。",
  "`disabled` (default): Connect shows the account picker when no account is connected": "`disabled`（默认）：未连接帐户时，Connect 显示帐户选择器。`enabled`：在 Windows 上，当 `microsoftAuthBroker` 未被禁用时，Connect 首先尝试使用 Windows 已在使用的帐户静默登录。受管 MCP 服务器中 `microsoft365` 条目上的 `tenantId` 必须为租户 GUID。对于 `common`、`organizations` 或 `consumers`，用户始终会看到选择器。当静默登录失败、计算机无法安全存储凭据、或者对于来自其他租户的帐户、访客帐户和个人 Microsoft 帐户，用户也会看到选择器。已通过浏览器登录 Microsoft 365 的用户将保留该帐户。用户断开 Microsoft 365 连接后，或其他人在此计算机上登录 Claude 后，Connect 始终会在此计算机上为该连接器显示选择器，包括在开启此设置之前发生的断开连接。关闭此设置会停止新的静默登录，且不会退出任何人的登录：已连接的用户将保留其帐户，直到他们主动断开连接。macOS 和 Linux 不受影响。仅限第三方部署：官方第一方安装会忽略此设置。",
  "A list of Claude.ai organization IDs (UUIDs)": "Claude.ai 组织 ID（UUID）列表。设置后，用户仅能通过登录 Claude.ai 并从列表中的组织进行导入；在下载任何内容之前，登录任何其他组织或个人帐户都将被拒绝。从文件以及从本计算机上早期会话导入的功能将被关闭。此列表会缩小 `enabled` 的生效范围，本身不会启用任何功能；`automatic3pImport` 不受影响。非 UUID 条目将不允许任何操作并被记录。空列表或无法读取的列表不允许任何组织，因此不提供任何导入；null 或空值将被读取为未设置。预配的登录导入未指定组织，因此在设置列表时不提供。每次导入都会作为 `desktop_claude_ai_import` 事件报告给您的 OpenTelemetry 收集器，并带有来源组织的 ID。这是一个 info 级别事件：将 `otlpDesktopLogLevel` 设置为 `info` 即可接收。",
  "Setting this key asks for 3P mode. The app opens in 3P mode unless the user chose to sign in to Claude.ai at the login screen": "设置此键将请求 3P 模式。除非用户在登录屏幕上选择登录 Claude.ai（`disableDeploymentModeChooser` 可移除该选项），否则应用将在 3P 模式下打开。在 3P 模式下，如果所选供应商所需的凭据键缺失或无效，应用将显示配置错误。当由全机设备管理下发时（macOS 配置描述文件、`HKLM` 下的 Windows 策略或 Linux 上 root 拥有的策略文件），应用无法读取的值（拼写错误、大小写错误或未知供应商，或错误类型的值）仍计为已设置。随后应用请求 3P 模式，并在 3P 模式下显示其详细信息中点名此键的配置错误。来自相同来源的无法读取的 `bootstrapUrl` 按相同方式计算，除非 `bootstrapEnabled` 为 `false`。在用户可写入的位置（本地配置文件或 `HKCU` 下的 Windows 策略），无法读取的值不计为已设置。空值（仅包含空格的值属于无法读取，而非空值）或类型为 `REG_BINARY`、`REG_MULTI_SZ` 或 `REG_QWORD` 的 Windows 值也不计为已设置。上述每种情况均读取为未设置。未设置此键时，应用将以标准模式启动，除非其他设置请求 3P 模式（例如未被 `bootstrapEnabled` 关闭的 `bootstrapUrl`）。所选供应商之外的其他供应商的键将被忽略。每个供应商所需的键均记录在“推理供应商”下的专门页面中。"
};
Object.assign(longDocs, newDocs);
fs.writeFileSync(longDocsPath, JSON.stringify(longDocs, null, 2) + '\n', 'utf8');
console.log(`✅ 长文档层同步就绪 (总文档数: ${Object.keys(longDocs).length})`);
console.log('🎉 全部字典同步与本地化注入完成！');
