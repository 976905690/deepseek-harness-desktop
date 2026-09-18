/**
 * 桌面媒体 toolview 纯逻辑模型测试（node 环境，无 React 渲染）。
 *
 * @module dsh-plugin-desktop/tests/client-media-toolview
 */

import { describe, expect, it } from 'vitest'
import { mediaBasename, mediaModeLabel, mediaViewFromBlock } from '../src/client/media-toolview-model.ts'

describe('媒体 toolview 视图状态推导', () => {
  it('未结算的调用块推导为 running', () => {
    // RunningToolCall 无 kind 字段
    expect(mediaViewFromBlock({ callId: 'c1', toolName: 'generate_video' })).toEqual({ kind: 'running' })
  })

  it('已结算且 meta 携带 localPath 时推导为 media，src 指向 /outputs 文件名', () => {
    const block = {
      kind: 'tool-result',
      meta: { localPath: 'D:\\li\\deepseek-harness-desktop\\dsh-plugin-desktop\\outputs\\a b.mp4', prompt: '一匹在草原上奔跑的马', bytes: 8 },
    }
    expect(mediaViewFromBlock(block)).toEqual({
      kind: 'media',
      src: `/outputs/${encodeURIComponent('a b.mp4')}`,
      localPath: 'D:\\li\\deepseek-harness-desktop\\dsh-plugin-desktop\\outputs\\a b.mp4',
      prompt: '一匹在草原上奔跑的马',
    })
  })

  it('meta 缺失或结构不符时回退 unavailable', () => {
    expect(mediaViewFromBlock({ kind: 'tool-result' })).toEqual({ kind: 'unavailable' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: null })).toEqual({ kind: 'unavailable' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { prompt: 'x' } })).toEqual({ kind: 'unavailable' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: 42 } })).toEqual({ kind: 'unavailable' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: '' } })).toEqual({ kind: 'unavailable' })
  })

  it('空 prompt 不写入 media 状态', () => {
    const state = mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: 'C:\\o\\v.mp4', prompt: '' } })
    expect(state).toEqual({ kind: 'media', src: '/outputs/v.mp4', localPath: 'C:\\o\\v.mp4' })
  })

  it('meta 携带 model/mode/notes 时逐字段透出（2026-09 插件透明字段）', () => {
    const state = mediaViewFromBlock({
      kind: 'tool-result',
      meta: {
        localPath: '/o/a.png',
        prompt: '赛博朋克猫',
        model: 'gpt-image-2',
        mode: 'image-to-image',
        notes: ['候选回退：threerouter → wanx'],
      },
    })
    expect(state).toEqual({
      kind: 'media',
      src: '/outputs/a.png',
      localPath: '/o/a.png',
      prompt: '赛博朋克猫',
      model: 'gpt-image-2',
      mode: 'image-to-image',
      notes: ['候选回退：threerouter → wanx'],
    })
  })

  it('meta 携带传输/提交次数/后处理时逐字段透出（生图事务自证字段）', () => {
    const state = mediaViewFromBlock({
      kind: 'tool-result',
      meta: {
        localPath: '/o/final.png',
        model: 'qwen-image-3.0',
        mode: 'image-to-image',
        transport: 'async',
        submitAttempts: 1,
        postprocess: ['品牌水印 Threerouter（bottom-right）'],
        notes: ['调用前预检查通过：传输=async'],
      },
    })
    expect(state).toEqual({
      kind: 'media',
      src: '/outputs/final.png',
      localPath: '/o/final.png',
      model: 'qwen-image-3.0',
      mode: 'image-to-image',
      transport: 'async',
      submitAttempts: 1,
      postprocess: ['品牌水印 Threerouter（bottom-right）'],
      notes: ['调用前预检查通过：传输=async'],
    })
  })

  it('提交次数必须是非负整数，非法值省略', () => {
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: '/o/a.png', submitAttempts: 1.5 } }))
      .toEqual({ kind: 'media', src: '/outputs/a.png', localPath: '/o/a.png' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: '/o/a.png', submitAttempts: -1 } }))
      .toEqual({ kind: 'media', src: '/outputs/a.png', localPath: '/o/a.png' })
    expect(mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: '/o/a.png', submitAttempts: 0 } }))
      .toEqual({ kind: 'media', src: '/outputs/a.png', localPath: '/o/a.png', submitAttempts: 0 })
  })

  it('model/mode/notes 类型不符或为空时逐字段省略，不影响媒体本体', () => {
    const state = mediaViewFromBlock({
      kind: 'tool-result',
      meta: { localPath: '/o/v.mp4', model: 42, mode: '', notes: ['x', 7, null, ''] },
    })
    expect(state).toEqual({
      kind: 'media',
      src: '/outputs/v.mp4',
      localPath: '/o/v.mp4',
      notes: ['x'],
    })
    // 全部无效 → 无 notes 键
    const bare = mediaViewFromBlock({ kind: 'tool-result', meta: { localPath: '/o/v.mp4', notes: [7, null] } })
    expect(bare).toEqual({ kind: 'media', src: '/outputs/v.mp4', localPath: '/o/v.mp4' })
  })

  it('mediaModeLabel：四种模式转中文，未知值原样，空值 undefined', () => {
    expect(mediaModeLabel('image-to-image')).toBe('图生图')
    expect(mediaModeLabel('text-to-image')).toBe('文生图')
    expect(mediaModeLabel('image-to-video')).toBe('图生视频')
    expect(mediaModeLabel('text-to-video')).toBe('文生视频')
    expect(mediaModeLabel('future-mode')).toBe('future-mode')
    expect(mediaModeLabel(undefined)).toBeUndefined()
    expect(mediaModeLabel('')).toBeUndefined()
  })
})

describe('mediaBasename 跨平台取末段', () => {
  it('兼容 Windows 反斜杠、POSIX 斜杠与无分隔符路径', () => {
    expect(mediaBasename('D:\\a\\b\\clip.mp4')).toBe('clip.mp4')
    expect(mediaBasename('/tmp/outputs/still.png')).toBe('still.png')
    expect(mediaBasename('plain.mp4')).toBe('plain.mp4')
  })
})
