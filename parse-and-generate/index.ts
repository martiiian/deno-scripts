import { existsSync } from "https://deno.land/std/fs/mod.ts";

interface item {
  id: number;
  file: string;
  slug: string;
}

interface ParsedFileField {
  path: string;
  fileName: string;
  ext: string;
}

interface ParsedItem {
  id: number;
  file: ParsedFileField;
  fileName: string;
  fileField: string;
}

const fileFieldParseRegex = /path: ([\w].*)\/([\w].*)\.([\w].*)/
const fileFieldReplaceRegex = /^([\s\S]*name: )[\s\S]*(\nsize:[\s\S]*path: )[\s\S]*$/
const queryReplaceRegex = /([\s\S]*){fileField}([\s\S]*){id}([\s\S]*)$/
const queryTemplate = `UPDATE cms_con_docs t SET t.file = '{fileField}' WHERE t.id = {id};\n`

function replaceFileField(item: ParsedItem) {
  const fileWithExt = `${item.fileName}.${item.file.ext}`
  const fileFieldReplaceTemplate = `$1${fileWithExt}$2${item.file.path}/${fileWithExt}`

  return item.fileField.replace(fileFieldReplaceRegex, fileFieldReplaceTemplate)
}

function generateQuery(fileField: string, id: number): string {
  const queryReplaceTemplate = `$1${fileField}$2${id}$3`

  return queryTemplate.replace(queryReplaceRegex, queryReplaceTemplate)
}

function renameFile(item: ParsedItem, path: string): boolean {
  const fromPath = `${path}${item.file.path}/${item.file.fileName}.${item.file.ext}`
  const exist = existsSync(fromPath)
  if (!exist) return false

  const toPath = `${path}${item.file.path}/${item.fileName}.${item.file.ext}`
  Deno.renameSync(fromPath, toPath)

  if (existsSync(toPath)) {
    // eslint-disable-next-line no-console
    console.log(`File successfully renamed: ${item.fileName}${item.file.ext}`)
    return true
  }

  console.error(`Error of rename file`)
  return existsSync(toPath)
}

function renameFilesAndGenerateQuery(items: ParsedItem[], path: string): string  {
  return items.reduce((query, item) => {
    const renameResult= renameFile(item, path)
    if (renameResult) {
      const updatedFileField = replaceFileField(item)
      query += generateQuery(updatedFileField, item.id)
    }

    return query
  }, '')
}

function parseSlug(value: string): string {
  return value.replace(/\d*-(.*)/, (_, val) => val)
}

function parseFileData(fileField: string): null | ParsedFileField {
  const [_, path, fileName, ext] = fileField.match(fileFieldParseRegex) || []

  return path && fileName && ext ? { path, fileName, ext } : null
}

function getFileNameIfExist(name: string): null | string {
  return name && existsSync(name) ? name : null;
}

function parseItems(fileName: string): ParsedItem[] | null {
  const data = Deno.readTextFileSync(fileName)
  const result: ParsedItem[] = []
  try {
    const items = JSON.parse(data) as item[]
    if (!items.length) {
      console.error('No items exist...')
      return null
    }

    for (const item of items) {
      const parsedFile = parseFileData(item.file)
      const parsedFileName = parseSlug(item.slug)
      if (parsedFileName && parsedFile) {
        result.push({
          id: item.id,
          fileName: parsedFileName,
          file: parsedFile,
          fileField: item.file,
        })
      }
    }

    return result
  } catch (e) {
    console.error('Error when parse file')
    return null
  }
}

(() => {
  if (Deno.args.length < 3) console.error('Needs more args..')

  const dataFileName = getFileNameIfExist(Deno.args[0])
  const filesFolderName = getFileNameIfExist(Deno.args[1])
  const queryOutputFile = getFileNameIfExist(Deno.args[2])

  if (!queryOutputFile) {
    console.error('Output file not exist, trying to create...')
    Deno.args[2] && Deno.createSync(Deno.args[2])
    if (existsSync(Deno.args[2])) {
      console.log('Output file successfully created!')
    } else {
      console.error('Failed to create output file..')
    }
  }

  if (!dataFileName) {
    console.error('Incorrect data file name!')
    return
  }

  if (!filesFolderName) {
    console.error('Incorrect files folder name!')
    return
  }

  const parsedItems = parseItems(dataFileName)
  if (!parsedItems) return

  const updatedQuery = renameFilesAndGenerateQuery(parsedItems, filesFolderName)

  Deno.writeTextFileSync(Deno.args[2], updatedQuery)
  console.log(`File renamed and file generated to: ${Deno.args[2]}!`)
})()
