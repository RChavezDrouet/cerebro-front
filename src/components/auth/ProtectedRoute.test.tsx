import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

import ProtectedRoute from './ProtectedRoute'

vi.mock('../../App', () => {
  return {
    useAuth: () => ({
      isAuthenticated: false,
      userRole: null,
      loading: false,
      initialized: true,
    }),
  }
})

describe('ProtectedRoute', () => {
  it('redirects to /login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Private</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('Login')).toBeInTheDocument()
  })
})
