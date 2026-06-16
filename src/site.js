const body = document.body
const menuButton = document.querySelector('[data-menu-toggle]')
const mobileNav = document.querySelector('[data-mobile-nav]')
const loginButtons = document.querySelectorAll('[data-open-login]')
const closeButtons = document.querySelectorAll('[data-close-login]')
const loginModal = document.querySelector('[data-login-modal]')
const loginForm = document.querySelector('[data-login-form]')
const languageSelects = document.querySelectorAll('[data-language-select]')

let lastTrigger = null

const applyLanguage = (lang) => {
  document.documentElement.lang = lang
  body.dataset.language = lang

  languageSelects.forEach((select) => {
    select.value = lang
  })

  window.localStorage.setItem('ntust-badminton-language', lang)
}


const closeMobileNav = () => {
  if (!menuButton || !mobileNav) {
    return
  }

  menuButton.setAttribute('aria-expanded', 'false')
  mobileNav.classList.remove('is-open')
}

const openLoginModal = (trigger) => {
  if (!loginModal) {
    return
  }

  lastTrigger = trigger || null
  loginModal.hidden = false
  body.classList.add('modal-open')

  const firstInput = loginModal.querySelector('input')
  if (firstInput) {
    window.setTimeout(() => firstInput.focus(), 50)
  }
}

const closeLoginModal = () => {
  if (!loginModal) {
    return
  }

  loginModal.hidden = true
  body.classList.remove('modal-open')

  if (lastTrigger) {
    lastTrigger.focus()
  }
}

if (menuButton && mobileNav) {
  menuButton.addEventListener('click', () => {
    const expanded = menuButton.getAttribute('aria-expanded') === 'true'
    menuButton.setAttribute('aria-expanded', String(!expanded))
    mobileNav.classList.toggle('is-open', !expanded)
  })
}

document.querySelectorAll('.mobile-nav a').forEach((link) => {
  link.addEventListener('click', closeMobileNav)
})

loginButtons.forEach((button) => {
  button.addEventListener('click', () => openLoginModal(button))
})

closeButtons.forEach((button) => {
  button.addEventListener('click', closeLoginModal)
})

if (loginModal) {
  loginModal.addEventListener('click', (event) => {
    const target = event.target
    if (target === loginModal || target.hasAttribute('data-modal-backdrop')) {
      closeLoginModal()
    }
  })
}

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const hint = loginForm.querySelector('[data-login-hint]')
    if (hint) {
      hint.textContent = '登入入口目前僅供版型展示，正式帳號驗證之後再接入即可。'
    }
  })
}

if (languageSelects.length > 0) {
  const savedLanguage = window.localStorage.getItem('ntust-badminton-language') || 'zh-Hant'
  applyLanguage(savedLanguage)

  languageSelects.forEach((select) => {
    select.addEventListener('change', (event) => {
      applyLanguage(event.target.value)
    })
  })
}

document.querySelectorAll('[data-faq-accordion]').forEach((group) => {
  const items = Array.from(group.querySelectorAll('.faq-item'))

  items.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) {
        return
      }

      items.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.open = false
        }
      })
    })
  })
})

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeMobileNav()
    if (loginModal && !loginModal.hidden) {
      closeLoginModal()
    }
  }
})
