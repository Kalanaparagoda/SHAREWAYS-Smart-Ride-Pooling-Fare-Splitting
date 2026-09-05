/**
 * CostSplitCard.test.jsx — unit tests for fare calculation display
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CostSplitCard from '../components/CostSplitCard'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'u1' } }),
}))

const mockProps = {
  totalCost: 6000,
  passengers: 4,
  costPerSeat: 1500,
}

describe('CostSplitCard', () => {
  it('renders the LKR currency label', () => {
    render(<CostSplitCard {...mockProps} />)
    const elements = screen.getAllByText(/LKR/i)
    expect(elements.length).toBeGreaterThan(0)
  })

  it('renders cost-related information', () => {
    render(<CostSplitCard {...mockProps} />)
    // Should mention the fare somewhere
    expect(screen.getByText(/1,500|1500/)).toBeInTheDocument()
  })
})
