import { afterEach, describe, expect, it, vi } from 'vitest'
import { meetingLink } from './api'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('meetingLink', () => {
  it('có VITE_PUBLIC_URL thì dùng domain public dù đang mở bằng localhost', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://peroxide-headway-speckled.ngrok-free.dev')

    expect(meetingLink('3F9A1C7E40B2D85A')).toBe(
      'https://peroxide-headway-speckled.ngrok-free.dev/meet/3F9A1C7E40B2D85A',
    )
  })

  it('bỏ dấu / thừa ở cuối VITE_PUBLIC_URL', () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://meet.congty.vn/')

    expect(meetingLink('ABCD')).toBe('https://meet.congty.vn/meet/ABCD')
  })

  it('không cấu hình thì dùng địa chỉ trang đang mở', () => {
    vi.stubEnv('VITE_PUBLIC_URL', '')

    expect(meetingLink('ABCD')).toBe(`${window.location.origin}/meet/ABCD`)
  })
})
