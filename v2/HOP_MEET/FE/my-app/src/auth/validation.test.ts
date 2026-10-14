import { describe, expect, it } from 'vitest'
import {
  passwordChecks,
  validateConfirm,
  validateEmail,
  validateName,
  validateNewPassword,
  validateRequired,
} from './validation'

describe('validateEmail', () => {
  it('bắt buộc nhập', () => {
    expect(validateEmail('   ')).toBe('Vui lòng nhập email.')
  })

  it('từ chối email sai định dạng', () => {
    expect(validateEmail('abc')).toBe('Email không hợp lệ.')
    expect(validateEmail('a@b')).toBe('Email không hợp lệ.')
    expect(validateEmail('a b@c.com')).toBe('Email không hợp lệ.')
  })

  it('chấp nhận email hợp lệ, bỏ khoảng trắng hai đầu', () => {
    expect(validateEmail(' an.nguyen@congty.vn ')).toBe('')
  })
})

describe('validateName', () => {
  it('bắt buộc và dài 2–100 ký tự sau khi bỏ khoảng trắng', () => {
    expect(validateName('  ')).toBe('Vui lòng nhập tên hiển thị.')
    expect(validateName(' A ')).toBe('Tên hiển thị dài từ 2 đến 100 ký tự.')
    expect(validateName('x'.repeat(101))).toBe('Tên hiển thị dài từ 2 đến 100 ký tự.')
    expect(validateName('Nguyễn An')).toBe('')
  })
})

describe('validateNewPassword', () => {
  it('kiểm tra từng quy tắc', () => {
    expect(passwordChecks('abc')).toEqual({ length: false, letter: true, digit: false })
    expect(passwordChecks('12345678')).toEqual({ length: true, letter: false, digit: true })
    expect(passwordChecks('mậtkhẩu9')).toEqual({ length: true, letter: true, digit: true })
  })

  it('trả lỗi đầu tiên chưa đạt', () => {
    expect(validateNewPassword('')).toBe('Vui lòng nhập mật khẩu.')
    expect(validateNewPassword('abc1')).toBe('Mật khẩu dài từ 8 đến 100 ký tự.')
    expect(validateNewPassword('abcdefgh')).toBe('Mật khẩu phải có cả chữ cái và chữ số.')
    expect(validateNewPassword('x1'.repeat(51))).toBe('Mật khẩu dài từ 8 đến 100 ký tự.')
    expect(validateNewPassword('abcd1234')).toBe('')
  })
})

describe('validateConfirm', () => {
  it('phải khớp mật khẩu', () => {
    expect(validateConfirm('abcd1234', '')).toBe('Vui lòng nhập lại mật khẩu.')
    expect(validateConfirm('abcd1234', 'abcd123')).toBe('Mật khẩu nhập lại không khớp.')
    expect(validateConfirm('abcd1234', 'abcd1234')).toBe('')
  })
})

describe('validateRequired', () => {
  it('chỉ kiểm tra có nhập hay không', () => {
    expect(validateRequired('', 'Vui lòng nhập mật khẩu.')).toBe('Vui lòng nhập mật khẩu.')
    expect(validateRequired('x', 'Vui lòng nhập mật khẩu.')).toBe('')
  })
})
