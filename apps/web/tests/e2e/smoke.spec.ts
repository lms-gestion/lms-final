import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('Page de login accessible', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText(/LA MAISON/i)).toBeVisible()
    await expect(page.getByPlaceholder(/email/i).first()).toBeVisible()
  })

  test('Page mot de passe oublié accessible', async ({ page }) => {
    await page.goto('/forgot-password')
    await expect(page.getByText(/mot de passe oublié/i)).toBeVisible()
  })

  test('Redirection / vers /login si non connecté', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })
})
