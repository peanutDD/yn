import config from './config'

const configKey = 'mark'

const defaultVal: MarkedFile[] = []

export interface MarkedFile {
  repo: string,
  path: string,
}

const list = () => {
  return config.get(configKey, defaultVal) as MarkedFile[]
}

const remove = (file: MarkedFile) => {
  config.set(configKey, list().filter(x => !(x.path === file.path && x.repo === file.repo)))
}

const add = (file: MarkedFile) => {
  remove(file)

  config.set(configKey, [file].concat(list()))
}

export default {
  list,
  add,
  remove,
}
