import lodash from 'lodash'
import Renderer from 'markdown-it/lib/renderer'
import { Plugin } from '@/useful/plugin'
import crypto from '@/useful/crypto'
import { dataURItoBlobLink, openInNewWindow } from '@/useful/utils'

const renderRule: Renderer.RenderRule = (tokens, idx, options, { source }, slf) => {
  const token = tokens[idx]
  const nextToken = tokens[idx + 1]
  if (token.level === 0 && token.map && nextToken && nextToken.attrGet('class')?.includes('mindmap')) {
    const content = source
      .split('\n')
      .slice(token.map[0], token.map[1])
      .join('\n')
      .replace(/\{.mindmap[^}]*\}/gm, '')
      .replace(/^(\s*)([+-]*|\d+.) /gm, '$1')

    token.attrJoin('class', 'mindmap-list')
    token.attrSet('data-mindmap-source', content)
  }

  return slf.renderToken(tokens, idx, options)
}

const buildSrcdoc = (json: string, btns: string) => {
  return `
    <html>
      <head>
        <link rel="stylesheet" href="${location.origin}/kityminder.core.css" rel="stylesheet">
        <script src="${location.origin}/kity.min.js"></script>
        <script src="${location.origin}/kityminder.core.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 0;
            height: 100%;
          }

          #minder-view {
            position: absolute;
            border: 1px solid #ccc;
            left: 10px;
            top: 10px;
            bottom: 10px;
            right: 10px;
          }
        </style>
      </head>
      <body style="width: 100%; height: 100vh; padding: 0; margin: 0">
        ${btns}
        <script id="minder-view" type="application/kityminder" minder-data-type="json">${json}</script>
        <script type="text/javascript">
          var km = window.km = new kityminder.Minder();
          km.setup('#minder-view');
          km.disable();
          km.execCommand('hand');

          const switchLayout = () => {
            const tplList = ['default', 'right', 'structure', 'filetree', 'tianpan', 'fish-bone']
            const tpl = km.getTemplate()
            const index = tplList.indexOf(tpl)
            const nextIndex = index > tplList.length - 2 ? 0 : index + 1
            km.useTemplate(tplList[nextIndex])
            km.execCommand('camera')
          }

          const switchCompat = () => {
            const theme = km.getTheme().split('-')
            if (theme[theme.length - 1] === 'compat') {
              theme.pop()
            } else {
              theme.push('compat')
            }

            km.useTheme(theme.join('-'))
            km.execCommand('camera')
          }

          const zoomOut = () => km.execCommand('zoomOut')
          const zoomIn = () => km.execCommand('zoomIn')
        </script>
      </body>
    </html>
  `
}

const render = async (ele: HTMLElement) => {
  const code = (ele.dataset.mindmapSource || '').trim()

  const div = document.createElement('div')
  div.setAttribute('minder-data-type', 'text')
  div.style.position = 'relative'
  div.style.height = '400px'
  ele.replaceWith(div)

  const km = new (window as any).kityminder.Minder()
  // Hack ?????????????????????????????????
  km.focus = () => 0
  km.setup(div)
  km.disable()
  try {
    await km.importData('text', code)
    km.useTemplate('default')
  } catch (error) {
    await km.importData('text', '????????????\n    1. ????????????????????????????????????\n    2. ???????????????????????????')
    km.useTemplate('structure')
  }

  km.execCommand('hand')
  km.useTheme('fresh-green-compat')
  km.execCommand('camera')

  const switchLayout = () => {
    const tplList = ['default', 'right', 'structure', 'filetree', 'tianpan', 'fish-bone']
    const tpl = km.getTemplate()
    const index = tplList.indexOf(tpl)
    const nextIndex = index > tplList.length - 2 ? 0 : index + 1
    km.useTemplate(tplList[nextIndex])
    km.execCommand('camera')
  }

  const switchCompat = () => {
    const theme = km.getTheme().split('-')
    if (theme[theme.length - 1] === 'compat') {
      theme.pop()
    } else {
      theme.push('compat')
    }

    km.useTheme(theme.join('-'))
    km.execCommand('camera')
  }

  const zoomOut = () => km.execCommand('zoomOut')
  const zoomIn = () => km.execCommand('zoomIn')

  const exportData = async (type: 'png' | 'svg' | 'km') => {
    const download = (url: string, name: string) => {
      const link = document.createElement('a')
      link.href = dataURItoBlobLink(url)
      link.target = '_blank'
      link.download = name
      link.click()
    }

    switch (type) {
      case 'svg':
        download('data:image/svg+xml;base64,' + crypto.strToBase64(await km.exportData('svg')), 'mindmap.svg')
        break
      case 'km':
        download('data:application/octet-stream;base64,' + crypto.strToBase64(await km.exportData('json')), 'mindmap.km')
        break
      case 'png':
        download(await km.exportData('png'), 'mindmap.png')
        break
      default:
        break
    }
  }

  const buildButton = (text: string, fun: () => void, onclick = '') => {
    const button = document.createElement('button')
    button.style.cssText = 'margin-left: 5px;font-size: 14px;background: #cacaca; border: 0; padding: 0 6px; color: #2c2b2b; cursor: pointer; border-radius: 2px; transition: all .3s ease-in-out; line-height: 24px;'
    button.innerText = text
    button.onclick = fun
    button.dataset.onclick = `${onclick}()`
    return button
  }

  const action = document.createElement('div')
  action.className = 'no-print'
  action.style.cssText = 'position: absolute; right: 15px; top: 3px; z-index: 1;'
  action.appendChild(buildButton('??????', zoomIn, 'zoomIn'))
  action.appendChild(buildButton('??????', zoomOut, 'zoomOut'))
  action.appendChild(buildButton('????????????', switchLayout, 'switchLayout'))
  action.appendChild(buildButton('??????/??????', switchCompat, 'switchCompat'))
  const actionsStr = action.outerHTML.replace(/data-onclick/g, 'onclick')
  action.appendChild(buildButton('???????????????', () => {
    const srcdoc = buildSrcdoc(JSON.stringify(km.exportJson()), actionsStr)
    openInNewWindow(srcdoc)
  }))
  action.appendChild(buildButton('?????? PNG', () => exportData('png')))
  action.appendChild(buildButton('?????? SVG', () => exportData('svg')))
  action.appendChild(buildButton('?????? KM', () => exportData('km')))

  div.appendChild(action)
}

export default {
  name: 'mind-map',
  register: ctx => {
    ctx.markdown.registerPlugin(md => {
      md.renderer.rules.bullet_list_open = renderRule
    })

    function renderMindMap ({ getViewDom }: any) {
      const refView: HTMLElement = getViewDom()
      const nodes = refView.querySelectorAll<HTMLElement>('.mindmap-list[data-mindmap-source]')
      nodes.forEach(render)
    }

    ctx.registerHook('ON_VIEW_RENDER', lodash.debounce(renderMindMap, 1000, { leading: true }))
  }
} as Plugin
