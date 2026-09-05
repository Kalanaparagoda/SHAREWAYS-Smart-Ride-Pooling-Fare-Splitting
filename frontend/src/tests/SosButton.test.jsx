/**
 * SosButton.test.jsx — unit tests for the SOS emergency button component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SosButton from '../components/SosButton'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}))

vi.mock('../api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: { status: 'ok', location_url: 'https://maps.google.com/?q=6.9,79.8' },
    }),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    custom: vi.fn(),
  },
}))

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({ coords: { latitude: 6.9271, longitude: 79.8612 } })
  ),
}
Object.defineProperty(global.navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
})

describe('SosButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the SOS button', () => {
    render(<SosButton />)
    expect(screen.getByRole('button', { name: /SOS Emergency Button/i })).toBeInTheDocument()
  })

  it('shows SOS label in idle state', () => {
    render(<SosButton />)
    expect(screen.getByText('SOS')).toBeInTheDocument()
  })

  it('shows confirmation dialog when clicked', async () => {
    render(<SosButton />)
    const sosBtn = screen.getByRole('button', { name: /SOS Emergency Button/i })
    fireEvent.click(sosBtn)
    await waitFor(() => {
      expect(screen.getByText(/Send SOS Alert/i)).toBeInTheDocument()
    })
  })

  it('has Cancel and Send SOS Now buttons in confirmation dialog', async () => {
    render(<SosButton />)
    fireEvent.click(screen.getByRole('button', { name: /SOS Emergency Button/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Send SOS Now/i })).toBeInTheDocument()
    })
  })

  it('closes confirmation dialog when Cancel is clicked', async () => {
    render(<SosButton />)
    fireEvent.click(screen.getByRole('button', { name: /SOS Emergency Button/i }))
    await waitFor(() => screen.getByText(/Send SOS Alert/i))
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    await waitFor(() => {
      expect(screen.queryByText(/Send SOS Alert/i)).not.toBeInTheDocument()
    })
  })
})
