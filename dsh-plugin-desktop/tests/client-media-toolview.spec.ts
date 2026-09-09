/**
 * 桌面媒体 toolview 纯逻辑模型测试（node 环境，无 React 渲染）。
 *
 * @module dsh-plugin-desktop/tests/client-media-toolview
 */

import { describe, expect, it } from 'vitest'
import { mediaBasename, mediaViewFromBlock } from '../src/client/media-toolview-model.ts'

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
})

describe('mediaBasename 跨平台取末段', () => {
  it('兼容 Windows 反斜杠、POSIX 斜杠与无分隔符路径', () => {
    expect(mediaBasename('D:\\a\\b\\clip.mp4')).toBe('clip.mp4')
    expect(mediaBasename('/tmp/outputs/still.png')).toBe('still.png')
    expect(mediaBasename('plain.mp4')).toBe('plain.mp4')
  })
})
