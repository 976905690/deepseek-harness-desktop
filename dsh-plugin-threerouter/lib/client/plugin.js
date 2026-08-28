window.__ModuleLoader__.load({
	id: "dsh-plugin-threerouter",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/threerouter-auth-ui.tsx
		/**
		* Deepseek Harness for Threerouter image/video : top-right account/balance/invite/model quick-switch UI.
		*
		* Renders inside the `shell.overlay` frame layer. All Threerouter backend work
		* happens on the host through the `/threerouter-auth` RPC channel; this surface
		* only talks to the host and to the sessions API for model switching.
		*/
		/** The host-registered RPC channel (see src/host/plugin.ts). */
		const CHANNEL = "/threerouter-auth";
		/** Provider id the host registers into llm-pi-ai after sign-in. */
		const PROVIDER = "threerouter";
		/**
		* Unwrap an RPC result into its value, throwing the reported error message.
		*/
		async function rpcValue(result) {
			if (!result.ok) throw new Error(result.error?.message ?? "Threerouter request failed");
			return result.value;
		}
		/** Copy text to the OS clipboard with a legacy fallback. */
		async function copyText(text) {
			try {
				await navigator.clipboard.writeText(text);
				return;
			} catch {
				const area = document.createElement("textarea");
				area.value = text;
				area.style.position = "fixed";
				area.style.opacity = "0";
				document.body.appendChild(area);
				area.select();
				document.execCommand("copy");
				area.remove();
			}
		}
		/** Format a signed balance for display (e.g. $12.50). */
		function formatBalance(value) {
			const amount = Number.isFinite(value) ? value : 0;
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency: "USD"
			}).format(amount);
		}
		/**
		* A floating chip in the top-right corner of the frame. Closed, it shows a
		* compact account pill (balance when signed in, login shortcut otherwise).
		* Open, it expands into a popover with login / profile / model-switch /
		* invite-share / logout actions.
		*/
		function ThreerouterAuthUI({ connection, sessions, platform, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [email, setEmail] = (0, react.useState)("");
			const [password, setPassword] = (0, react.useState)("");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [session, setSession] = (0, react.useState)(null);
			/** Fallback catalog shown before the host returns a live list. */
			const FALLBACK_MODELS = [
				{
					id: "deepseek-v4-pro",
					name: "DeepSeek V4 Pro",
					supported: true
				},
				{
					id: "deepseek-v4-flash",
					name: "DeepSeek V4 Flash",
					supported: true
				},
				{
					id: "deepseek-v3",
					name: "DeepSeek V3",
					supported: true
				},
				{
					id: "gpt-4o",
					name: "GPT-4o",
					supported: true
				},
				{
					id: "gpt-4o-mini",
					name: "GPT-4o Mini",
					supported: true
				},
				{
					id: "claude-3-5-sonnet-latest",
					name: "Claude 3.5 Sonnet",
					supported: true
				},
				{
					id: "claude-3-opus-latest",
					name: "Claude 3 Opus",
					supported: true
				},
				{
					id: "gemini-1.5-pro",
					name: "Gemini 1.5 Pro",
					supported: true
				}
			];
			const [models, setModels] = (0, react.useState)([]);
			const [currentModel, setCurrentModel] = (0, react.useState)("deepseek-v4-pro");
			const [notice, setNotice] = (0, react.useState)(null);
			const showNotice = (0, react.useCallback)((message) => {
				setNotice(message);
				const timer = setTimeout(() => setNotice(null), 2600);
				return () => clearTimeout(timer);
			}, []);
			/** Fetch the persisted Threerouter profile on mount (in-memory host session). */
			const refreshSession = (0, react.useCallback)(async () => {
				try {
					const data = await rpcValue(await connection.rpc.call(CHANNEL, "getProfile", {}));
					setSession({
						email: data.profile.email,
						username: data.profile.username || (data.profile.email.split("@")[0] ?? "User"),
						balance: data.balance,
						affCode: data.affCode,
						hasApiKey: data.hasApiKey
					});
					setError(null);
					setEmail(data.profile.email);
					return true;
				} catch {
					setSession(null);
					return false;
				}
			}, [connection]);
			/** Refresh the supported model catalog through the host. */
			const refreshModels = (0, react.useCallback)(async () => {
				try {
					const data = await rpcValue(await connection.rpc.call(CHANNEL, "getModels", {}));
					setModels(data.models);
					if (data.defaultModel) setCurrentModel(data.defaultModel);
				} catch {}
			}, [connection]);
			(0, react.useEffect)(() => {
				refreshSession().then((signedIn) => {
					if (signedIn) refreshModels();
				});
			}, [refreshSession, refreshModels]);
			/** Read the active model on the current session when the popover opens. */
			const syncCurrentModel = (0, react.useCallback)(async () => {
				const id = sessions.list.getSnapshot().current;
				if (id === void 0) return;
				try {
					const dir = await connection.api.sessions.models({ sessionId: id });
					const sel = dir.result.ok ? dir.result.value.current : void 0;
					if (sel?.model) setCurrentModel(sel.model);
				} catch {}
			}, [connection, sessions]);
			const handleLogin = (0, react.useCallback)(async () => {
				if (!email || !password) {
					setError(t("enterCredentials"));
					return;
				}
				setBusy(true);
				setError(null);
				try {
					await rpcValue(await connection.rpc.call(CHANNEL, "login", {
						email,
						password
					}));
					setPassword("");
					await refreshSession();
					await refreshModels();
					showNotice(t("loggedInNotice"));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}, [
				connection,
				email,
				password,
				refreshSession,
				refreshModels,
				showNotice,
				t
			]);
			const handleRegister = (0, react.useCallback)(() => {
				window.open("https://www.threerouter.com/register", "_blank", "noopener,noreferrer");
			}, []);
			const handleLogout = (0, react.useCallback)(async () => {
				setBusy(true);
				try {
					await connection.rpc.call(CHANNEL, "logout", {});
					setSession(null);
					setModels([]);
					setOpen(false);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}, [connection]);
			const handleShare = (0, react.useCallback)(async () => {
				try {
					await copyText((await rpcValue(await connection.rpc.call(CHANNEL, "copyInviteLink", {}))).link);
					showNotice(t("inviteCopied"));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			}, [connection, showNotice]);
			const handleSelectModel = (0, react.useCallback)(async (modelId) => {
				const id = sessions.list.getSnapshot().current;
				if (id === void 0) {
					showNotice(t("openSessionFirst"));
					return;
				}
				setBusy(true);
				try {
					const res = await connection.api.sessions.selectModel({
						sessionId: id,
						provider: PROVIDER,
						model: modelId
					});
					const selected = res.result.ok ? res.result.value.selected : void 0;
					if (selected?.model) setCurrentModel(selected.model);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(false);
				}
			}, [
				connection,
				sessions,
				showNotice
			]);
			const toggle = (0, react.useCallback)(() => {
				setOpen((prev) => {
					const next = !prev;
					if (next) refreshSession().then((signedIn) => {
						if (signedIn) {
							refreshModels();
							syncCurrentModel();
						}
					});
					return next;
				});
			}, [
				refreshSession,
				refreshModels,
				syncCurrentModel
			]);
			const platformClass = platform === "darwin" ? "tr-darwin" : platform === "win32" ? "tr-win32" : "tr-linux";
			const initial = session ? (session.username[0] ?? "?").toUpperCase() : "T";
			const signedIn = session !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `trAuth trAuth-${platformClass}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "trAuthPill",
					onClick: toggle,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					title: signedIn ? `${session.email} · ${formatBalance(session.balance)}` : t("signInTitle"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "trAuthAvatar",
							children: initial
						}),
						signedIn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "trAuthBalance",
							children: formatBalance(session.balance)
						}),
						!signedIn && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "trAuthLabel",
							children: t("signIn")
						})
					]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "trAuthDialog",
					role: "dialog",
					"aria-label": t("account"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "trAuthDialogHeader",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("account") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "trAuthClose",
								"aria-label": t("close"),
								onClick: () => setOpen(false),
								children: "✕"
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "trAuthError",
							children: error
						}),
						notice !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "trAuthNotice",
							children: notice
						}),
						!signedIn ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "trAuthLogin",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("email") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "email",
									value: email,
									autoComplete: "email",
									placeholder: "you@example.com",
									onChange: (e) => setEmail(e.target.value)
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("password") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "password",
									value: password,
									autoComplete: "current-password",
									placeholder: "••••••••",
									onChange: (e) => setPassword(e.target.value),
									onKeyDown: (e) => {
										if (e.key === "Enter") handleLogin();
									}
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "trAuthPrimary",
									disabled: busy,
									onClick: () => void handleLogin(),
									children: busy ? t("signingIn") : t("signIn")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "trAuthRegister",
									onClick: handleRegister,
									children: t("createAccount")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "trAuthCloseBtn",
									onClick: () => setOpen(false),
									children: t("close")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "trAuthHint",
									children: t("apiKeyHint")
								})
							]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "trAuthProfile",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "trAuthProfileRow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trAuthEmail",
										title: session.email,
										children: session.email
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trAuthBalanceBig",
										children: formatBalance(session.balance)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "trAuthProfileRow",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trAuthFieldLabel",
										children: t("accountBalance")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "trAuthCopyHint",
										children: session.hasApiKey ? t("apiKeyReady") : t("apiKeyNotCreated")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "trAuthSection",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "trAuthSectionTitle",
										children: t("quickModelSwitch")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
										className: "trAuthSelect",
										value: currentModel,
										disabled: busy,
										onChange: (e) => void handleSelectModel(e.target.value),
										children: (models.length > 0 ? models : FALLBACK_MODELS).map((m) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
											value: m.id,
											children: m.name
										}, m.id))
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "trAuthActions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "trAuthSecondary",
										disabled: busy,
										onClick: () => void handleShare(),
										children: t("shareInviteLink")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "trAuthDanger",
										disabled: busy,
										onClick: () => void handleLogout(),
										children: t("signOut")
									})]
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region src/client/threerouter-logo.tsx
		/**
		* Compact icon logo used in the collapsed sidebar rail.
		* A stylised three-arc motif (three routes → threerouter).
		*/
		function ThreerouterIcon({ size = 24, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				className,
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z",
						stroke: "currentColor",
						strokeWidth: "1.5",
						fill: "none"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12 2v10l6 6M12 12l-6 6M12 12l2-8M12 12l-2 8",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "2.5",
						fill: "currentColor"
					})
				]
			});
		}
		/**
		* Full wordmark logo used in the expanded sidebar.
		* Icon + "Threerouter" lettering.
		*/
		function ThreerouterWordmark({ size = 24, className }) {
			const wordmarkHeight = size;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: wordmarkHeight * 160 / 24,
				height: wordmarkHeight,
				className,
				viewBox: "0 0 160 24",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "10",
						stroke: "currentColor",
						strokeWidth: "1.5",
						fill: "none"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12 2v10l6 6M12 12l-6 6M12 12l2-8M12 12l-2 8",
						stroke: "currentColor",
						strokeWidth: "1.5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "2",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: "28",
						y: "17",
						fontFamily: "system-ui, -apple-system, sans-serif",
						fontSize: "13",
						fontWeight: "600",
						fill: "currentColor",
						letterSpacing: "0.5",
						children: "Threerouter"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: "28",
						y: "22",
						fontFamily: "system-ui, -apple-system, sans-serif",
						fontSize: "7",
						fontWeight: "400",
						fill: "currentColor",
						letterSpacing: "2",
						opacity: "0.65",
						children: "HARNESS"
					})
				]
			});
		}
		//#endregion
		//#region src/client/threerouter-sidebar.tsx
		/**
		* Threerouter sidebar shell: replaces the upstream SidebarRoot with
		* Threerouter-branded logo/wordmark while keeping the same layout,
		* collapse/expand animation, and child slot delegation.
		*
		* The slot contract is identical to the upstream SidebarRoot — the same
		* children (sidebar.workspaces, sidebar.settings, sidebar.footer.action)
		* are rendered via renderSlot(), declared by the upstream plugin.
		*/
		/** Wide-content unmount delay; matches the upstream 150ms fade-out. */
		const COLLAPSE_SETTLE_MS = 150;
		/**
		* Sidebar column shell with Threerouter branding.
		*
		* Props composition mirrors the upstream SidebarRootComponentProps:
		*   collapsed, width → runtime props from slot framework
		*   startSession, toggleSidebar → injected callbacks
		*   t → locale function
		*   renderSlot → child slot renderer (provided by slot framework)
		*/
		function ThreerouterSidebar(props) {
			const { collapsed, width, startSession, toggleSidebar, t, renderSlot } = props;
			const [settled, setSettled] = (0, react.useState)(collapsed);
			(0, react.useEffect)(() => {
				if (!collapsed) {
					setSettled(false);
					return;
				}
				const timer = window.setTimeout(() => {
					setSettled(true);
				}, COLLAPSE_SETTLE_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, [collapsed]);
			const wide = !collapsed || !settled;
			const lastWideWidth = (0, react.useRef)(width);
			if (!collapsed) lastWideWidth.current = width;
			const everWide = (0, react.useRef)(!collapsed);
			if (!collapsed) everWide.current = true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: clsx("trSidebarRoot", !wide && "trSidebarCollapsed", !wide && everWide.current && "trSidebarRailIn", collapsed && wide && "trSidebarFading"),
				style: wide ? { width: collapsed ? lastWideWidth.current : width } : void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "trSidebarLogoRow",
						children: [wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: clsx("trSidebarBrand", "trSidebarWide"),
							"aria-label": t("session.new.label"),
							onClick: () => {
								startSession();
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreerouterWordmark, {})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: collapsed ? t("toggle.open") : t("toggle.collapse"),
							delayMs: 500,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: clsx("trSidebarIconButton", "trSidebarToggle"),
								"aria-label": collapsed ? t("toggle.open") : t("toggle.collapse"),
								onClick: () => {
									toggleSidebar();
								},
								children: [!wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ThreerouterIcon, {
									className: "trSidebarRailIcon",
									size: 24
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, {
									className: "trSidebarPanelIcon",
									size: wide ? 16 : 18
								})]
							})
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: t("session.new.label"),
						delayMs: 500,
						disabled: wide,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "trSidebarNewSession",
							"aria-label": t("session.new.label"),
							onClick: () => {
								startSession();
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNewChatOutline16, { size: wide ? 14 : 18 }), wide && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: clsx("trSidebarNewSessionLabel", "trSidebarWide"),
								children: t("session.new")
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "trSidebarRegionArea",
						children: renderSlot("sidebar.workspaces", {
							wide,
							expandSidebar: () => {
								if (collapsed) toggleSidebar();
							}
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "trSidebarFootArea",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "trSidebarFooterActions",
							children: renderSlot("sidebar.footer.action", { wide })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "trSidebarSettingsArea",
							children: renderSlot("sidebar.settings", { wide })
						})]
					})
				]
			});
		}
		/** Combined zh/en bundle passed to `ctx.locale.register('threerouter', …)`. */
		const threerouterLocale = {
			zh: {
				account: "Threerouter 1$ ≈ 30M token",
				close: "关闭",
				signInTitle: "登录 Threerouter 账号",
				signIn: "登录",
				signingIn: "登录中…",
				email: "邮箱",
				password: "密码",
				enterCredentials: "请输入邮箱和密码",
				createAccount: "注册账号",
				apiKeyHint: "登录后自动申请并配置 API Key，默认使用 deepseek-v4-pro 模型。",
				loggedInNotice: "已登录 Threerouter，API Key 已自动配置",
				accountBalance: "账户余额",
				apiKeyReady: "API Key 已就绪",
				apiKeyNotCreated: "API Key 未创建",
				quickModelSwitch: "快速切换模型",
				shareInviteLink: "分享邀请链接",
				signOut: "退出登录",
				inviteCopied: "分享链接已复制到剪贴板",
				openSessionFirst: "请先打开一个会话再切换模型"
			},
			en: {
				account: "Threerouter 1$ ≈ 30M token",
				close: "Close",
				signInTitle: "Sign in to your Threerouter account",
				signIn: "Sign in",
				signingIn: "Signing in…",
				email: "Email",
				password: "Password",
				enterCredentials: "Please enter your email and password.",
				createAccount: "Create an account",
				apiKeyHint: "Your API key is configured automatically after sign-in. The default model is deepseek-v4-pro.",
				loggedInNotice: "Signed in to Threerouter. API key configured automatically.",
				accountBalance: "Account balance",
				apiKeyReady: "API key ready",
				apiKeyNotCreated: "API key not created",
				quickModelSwitch: "Quick model switch",
				shareInviteLink: "Share invite link",
				signOut: "Sign out",
				inviteCopied: "Invite link copied to clipboard",
				openSessionFirst: "Please open a session before switching models"
			}
		};
		//#endregion
		//#region src/client/environment.ts
		const MODES = /* @__PURE__ */ new Set([
			"compatibility",
			"extended",
			"advanced"
		]);
		const PLATFORMS = /* @__PURE__ */ new Set([
			"darwin",
			"win32",
			"linux"
		]);
		/**
		* Resolve the Threerouter renderer environment from the page URL search string.
		* @param search - URL search string, including or omitting the leading `?`.
		* @returns the validated environment, or undefined outside the desktop shell.
		*/
		function parseThreerouterClientEnvironment(search) {
			const params = new URLSearchParams(search);
			const mode = params.get("dsh-desktop-mode");
			const platform = params.get("dsh-desktop-platform");
			const version = params.get("dsh-desktop-version");
			const windowTitle = params.get("dsh-desktop-title");
			if (mode === null && platform === null) return void 0;
			if (!MODES.has(mode)) return void 0;
			if (!PLATFORMS.has(platform)) return void 0;
			if (version === null) return void 0;
			const title = windowTitle === null || windowTitle === "" ? void 0 : windowTitle;
			return {
				mode,
				platform,
				version,
				...title === void 0 ? {} : { windowTitle: title }
			};
		}
		//#endregion
		//#region src/client/styles.ts
		/** Threerouter-owned stylesheet kept as a plain string so the client bundle stays self-contained. */
		const THREEROUTER_OWNED_STYLES = `
/* ---- Threerouter account / balance / invite / model-switch (shell.overlay) ---- */
.trAuth { position: absolute; top: 48px; right: 180px; z-index: 1100; font-family: inherit; }
.trAuthPill { display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px 0 4px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 999px; background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); cursor: pointer; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12); transition: background var(--ds-transition-duration-fast) var(--ds-ease), border-color var(--ds-transition-duration-fast) var(--ds-ease); }
.trAuthPill:hover { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-border-l3); }
.trAuthAvatar { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); font-size: 12px; font-weight: 600; }
.trAuthBalance { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.trAuthLabel { font-size: 12px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.trAuthDialog { position: absolute; top: 40px; right: 0; width: 300px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 12px; background: var(--dsw-alias-bg-layer-3); box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18); color: var(--dsw-alias-label-primary); overflow: hidden; }
.trAuthDialogHeader { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }
.trAuthClose { border: none; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 13px; line-height: 1; padding: 4px; }
.trAuthClose:hover { color: var(--dsw-alias-label-primary); }
.trAuthError { margin: 10px 14px 0; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-state-error-secondary); color: #fff; font-size: 12px; }
.trAuthNotice { margin: 10px 14px 0; padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-state-success-tertiary); color: var(--dsw-alias-label-primary); font-size: 12px; }
.trAuthLogin, .trAuthProfile { padding: 12px 14px; display: flex; flex-direction: column; gap: 10px; }
.trAuthLogin label { display: flex; flex-direction: column; gap: 4px; color: var(--dsw-alias-label-primary); font-size: 12px; }
.trAuthLogin input { height: 32px; padding: 0 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-specific-login-input, var(--dsw-alias-bg-layer-2, rgba(127, 133, 143, 0.08))); color: var(--dsw-alias-label-primary); font-size: 13px; outline: none; color-scheme: inherit; }
.trAuthLogin input::placeholder { color: var(--dsw-alias-label-tertiary, #98a2b3); opacity: 1; }
.trAuthLogin input:focus { border-color: var(--dsw-alias-state-business-primary); }
.trAuthHint { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 1.5; }
.trAuthPrimary { height: 34px; border: none; border-radius: 8px; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); font-size: 13px; font-weight: 600; cursor: pointer; }
.trAuthPrimary:hover { background: var(--dsw-alias-button-primary-hover); }
.trAuthPrimary:disabled { background: var(--dsw-alias-button-primary-dimmed); cursor: default; }
.trAuthRegister { height: 34px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; cursor: pointer; }
.trAuthRegister:hover { background: var(--dsw-alias-interactive-bg-hover); }
.trAuthCloseBtn { height: 32px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); font-size: 13px; font-weight: 500; cursor: pointer; }
.trAuthCloseBtn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.trAuthProfileRow { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.trAuthEmail { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trAuthBalanceBig { font-size: 15px; font-weight: 700; color: var(--dsw-alias-label-primary); }
.trAuthFieldLabel { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.trAuthCopyHint { font-size: 12px; color: var(--dsw-alias-state-success-primary); }
.trAuthSection { display: flex; flex-direction: column; gap: 6px; }
.trAuthSectionTitle { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.trAuthSelect { height: 32px; padding: 0 8px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-specific-login-input); color: var(--dsw-alias-label-primary); font-size: 13px; outline: none; }
.trAuthActions { display: flex; gap: 8px; }
.trAuthSecondary { flex: 1; height: 32px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.trAuthSecondary:hover { background: var(--dsw-alias-interactive-bg-hover); }
.trAuthDanger { height: 32px; padding: 0 12px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: var(--dsw-alias-state-error-primary); font-size: 12px; font-weight: 600; cursor: pointer; }
.trAuthDanger:hover { background: var(--dsw-alias-interactive-bg-hover-danger); }

/* ---- Threerouter sidebar (replaces upstream SidebarRoot) ---- */
.trSidebarRoot {
  --dsh-sidebar-inline-padding: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 6px var(--dsh-sidebar-inline-padding);
  box-sizing: border-box;
  background: var(--dsw-specific-sidebar-fill);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.trSidebarCollapsed {
  padding: 18px 10px 6px;
}
.trSidebarFading > * {
  opacity: 0;
  transition: opacity 150ms var(--ds-ease-in-out);
}
.trSidebarWide {
  animation: trSidebarWideIn 200ms var(--ds-ease-in-out);
}
@keyframes trSidebarWideIn {
  from { opacity: 0; }
}
.trSidebarRailIn .trSidebarIconButton,
.trSidebarRailIn .trSidebarNewSession,
.trSidebarRailIn .trSidebarRegionArea {
  animation: trSidebarRailIn 150ms var(--ds-ease-in-out) backwards;
}
.trSidebarRailIn .trSidebarFootArea {
  animation: trSidebarFadeIn 150ms var(--ds-ease-in-out) backwards;
}
@keyframes trSidebarRailIn {
  from { opacity: 0; transform: translateX(49px); }
}
@keyframes trSidebarFadeIn {
  from { opacity: 0; }
}
.trSidebarLogoRow {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  height: 60px;
  padding: 8px 0 8px 4px;
  margin-bottom: 8px;
  box-sizing: border-box;
  overflow: hidden;
}
.trSidebarCollapsed .trSidebarLogoRow {
  height: 36px;
  padding: 0;
  margin-bottom: 12px;
  justify-content: flex-start;
}
.trSidebarBrand {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.trSidebarIconButton {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  padding: 0;
  background: transparent;
  cursor: pointer;
  color: var(--dsw-alias-label-secondary);
}
.trSidebarIconButton:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.trSidebarCollapsed .trSidebarIconButton {
  width: 36px;
  height: 36px;
}
.trSidebarCollapsed .trSidebarToggle .trSidebarPanelIcon {
  display: none;
}
.trSidebarCollapsed .trSidebarToggle:hover .trSidebarPanelIcon {
  display: inline;
}
.trSidebarCollapsed .trSidebarToggle:hover .trSidebarRailIcon {
  display: none;
}
.trSidebarCollapsed .trSidebarIconButton {
  color: var(--dsw-alias-label-primary);
}
.trSidebarNewSession {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  padding: 8px 16px;
  margin: 0 2px 8px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-button-elevated-fill);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  cursor: pointer;
  overflow: hidden;
}
.trSidebarNewSession:hover {
  background: var(--dsw-alias-button-floating-hover);
}
.trSidebarCollapsed .trSidebarNewSession {
  align-self: flex-start;
  width: 36px;
  height: 36px;
  padding: 0;
  margin: 0 0 12px;
  gap: 0;
  border-color: transparent;
  background: transparent;
}
.trSidebarCollapsed .trSidebarNewSession:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.trSidebarNewSessionLabel {
  max-width: 200px;
  overflow: hidden;
  white-space: nowrap;
}
.trSidebarCollapsed .trSidebarNewSessionLabel {
  max-width: 0;
}
.trSidebarRegionArea {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin-left: -4px;
  margin-right: calc(-1 * var(--dsh-sidebar-inline-padding));
  padding-left: 4px;
  overflow: hidden;
}
.trSidebarCollapsed .trSidebarRegionArea {
  margin-left: 0;
  margin-right: 0;
  padding-left: 0;
}
.trSidebarFootArea {
  flex: none;
  display: flex;
  flex-direction: column;
}
.trSidebarSettingsArea,
.trSidebarFooterActions {
  flex: none;
  min-width: 0;
  width: 100%;
}
.trSidebarFooterActions {
  display: flex;
}
.trSidebarCollapsed .trSidebarFootArea {
  align-items: center;
}
.trSidebarCollapsed .trSidebarSettingsArea,
.trSidebarCollapsed .trSidebarFooterActions {
  display: flex;
  justify-content: center;
  width: auto;
}
@media (prefers-reduced-motion: reduce) {
  .trSidebarWide,
  .trSidebarFading > *,
  .trSidebarRailIn .trSidebarIconButton,
  .trSidebarRailIn .trSidebarNewSession,
  .trSidebarRailIn .trSidebarFootArea,
  .trSidebarRailIn .trSidebarRegionArea {
    transition: none;
    animation: none;
  }
}
`;
		/** Install Threerouter-owned panel styles for the auth overlay and branded sidebar. */
		function installThreerouterStyles() {
			const style = document.createElement("style");
			style.dataset.plugin = "dsh-plugin-threerouter";
			style.dataset.pluginCss = "dsh-plugin-threerouter/threerouter-owned-styles";
			style.textContent = THREEROUTER_OWNED_STYLES;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		//#endregion
		//#region src/client/plugin.ts
		/** Services required by the Threerouter client surfaces. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"sessions",
			"workspaces"
		];
		/**
		* Register the Threerouter sidebar and auth overlay for the advanced shell.
		*
		* Stays inert outside the desktop advanced shell — the environment markers are
		* only injected by the Electron Host for advanced mode, so this plugin does
		* nothing in compatibility/extended mode or the upstream Web bundle.
		* @param ctx - browser Cordis context.
		*/
		function apply(ctx) {
			const environment = parseThreerouterClientEnvironment(window.location.search);
			if (environment === void 0) return;
			if (environment.mode !== "advanced") return;
			ctx.effect(() => installThreerouterStyles(), "threerouter: owned styles");
			ctx.effect(() => {
				const injectProps = () => ({
					startSession: (workspaceId) => {
						ctx.workspaces.startSession(workspaceId);
					},
					toggleSidebar: () => {
						ctx.layout?.toggleSidebar?.();
					},
					version: environment.version
				});
				return ctx.slots.inject("sidebar", () => ctx.slots.register({
					name: "sidebar",
					priority: -1,
					locale: "sidebar",
					inject: injectProps
				}, ThreerouterSidebar));
			}, "threerouter: sidebar slot");
			ctx.effect(() => {
				const disposeLocale = ctx.locale.register("threerouter", threerouterLocale);
				const disposeSlot = ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "threerouter-auth-ui",
					locale: "threerouter",
					inject: () => ({
						connection: ctx.get("connection"),
						sessions: ctx.get("sessions"),
						platform: environment.platform
					})
				}, ThreerouterAuthUI));
				return () => {
					disposeSlot();
					disposeLocale();
				};
			}, "threerouter: auth UI slot");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=plugin.js.map