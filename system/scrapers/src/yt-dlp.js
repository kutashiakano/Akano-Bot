const { spawn } = require('child_process')
const fs = require('fs/promises')
const path = require('path')

class MediaDownloader {
  constructor(config = {}) {
    this.ytDlpBin = config.ytDlpBin || 'yt-dlp'
    this.galleryDlBin = config.galleryDlBin || 'gallery-dl'
    this.baseDir = config.baseDir || path.join(__dirname, '../../../tmp')
    this._initialized = false
  }

  async _ensureDependencies() {
    if (this._initialized) return
    const checkBin = (bin) => new Promise((resolve) => {
      const proc = spawn(bin, ['--version'], { shell: false, stdio: 'ignore' })
      proc.on('error', () => resolve(false))
      proc.on('close', (code) => resolve(code === 0))
    })
    const ytdlpExists = await checkBin(this.ytDlpBin)
    const galleryDlExists = await checkBin(this.galleryDlBin)
    if (!ytdlpExists || !galleryDlExists) {
      const pipCmd = process.platform === 'win32' ? 'pip' : 'pip3'
      const args = ['install', '--break-system-packages', '-U', 'yt-dlp', 'gallery-dl']
      try {
        await this._execute(pipCmd, args, process.cwd())
      } catch (e) {
        try { await this._execute('pip', args, process.cwd()) } catch {}
      }
    }
    this._initialized = true
  }

  async _ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true })
  }

  _isGalleryUrl(url) {
    const igPostRegex = /instagram\.com\/p\//i
    const pinterestRegex = /pinterest\.[a-z.]+\/pin\//i
    return igPostRegex.test(url) || pinterestRegex.test(url)
  }

  _execute(bin, args, cwd) {
    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, { cwd, shell: false })
      let stdout = ''
      let stderr = ''
      proc.stdout.on('data', (data) => { stdout += data.toString() })
      proc.stderr.on('data', (data) => { stderr += data.toString() })
      proc.on('error', reject)
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(stderr || stdout || `Process exited with code ${code}`))
        }
      })
    })
  }

  async getMetadata(url, options = {}) {
    await this._ensureDependencies()
    const isInstagram = /instagram\.com/i.test(url)
    const isTiktok = /tiktok\.com|vt\.tiktok\.com/i.test(url)
    const isGallery = this._isGalleryUrl(url)
    
    let bin, args
    
    if (isInstagram) {
      bin = this.ytDlpBin
      args = ['-j', '--skip-download', '--ignore-no-formats-error']
    } else if (isGallery) {
      bin = this.galleryDlBin
      args = ['-j']
    } else {
      bin = this.ytDlpBin
      args = ['-j', '--skip-download']
    }

    if (options.cookies) args.push('--cookies', options.cookies)
    if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser)
    
    args.push(url)
    
    let stdout, stderr
    try {
      const result = await this._execute(bin, args, this.baseDir)
      stdout = result.stdout
      stderr = result.stderr
    } catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        const fallbackArgs = ['-j']
        if (options.cookies) fallbackArgs.push('--cookies', options.cookies)
        if (options.cookiesFromBrowser) fallbackArgs.push('--cookies-from-browser', options.cookiesFromBrowser)
        fallbackArgs.push(url)
        const fallbackResult = await this._execute(this.galleryDlBin, fallbackArgs, this.baseDir)
        stdout = fallbackResult.stdout
        stderr = fallbackResult.stderr
        bin = this.galleryDlBin
      } else {
        throw err
      }
    }
    
    if (bin === this.galleryDlBin || isGallery) {
      let results = []
      let jsonString = stdout.trim()
      try {
        const parsed = JSON.parse(jsonString)
        results = Array.isArray(parsed) ? parsed : [parsed]
      } catch (e) {
        const lines = jsonString.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try { results.push(JSON.parse(trimmed)) } catch {}
          }
        }
        if (results.length === 0) {
          try {
            const fixed = '[' + jsonString.replace(/\}\s*\{/g, '},{') + ']'
            const parsed = JSON.parse(fixed)
            if (Array.isArray(parsed)) results = parsed
          } catch {}
        }
      }
      if (results.length === 0) throw new Error(stderr || 'Failed to parse gallery metadata.')
      return results
    }
    
    if (isInstagram) {
      try {
        const parsed = JSON.parse(stdout.trim())
        if (parsed._type === 'playlist' && Array.isArray(parsed.entries)) {
          return parsed.entries
        }
        if (Array.isArray(parsed)) return parsed
        return [parsed]
      } catch (e) {
        throw new Error(stderr || 'Failed to parse Instagram metadata')
      }
    }
    
    try { 
      const parsed = JSON.parse(stdout.trim())
      if (parsed._type === 'playlist' && Array.isArray(parsed.entries)) {
        return parsed.entries
      }
      return parsed 
    } catch { 
      throw new Error(stderr || 'Failed to parse video metadata') 
    }
  }

  async checkProfile(url, options = {}) {
    await this._ensureDependencies()
    const bin = this.ytDlpBin
    const args = ['--flat-playlist', '--dump-single-json', '--no-warnings']
    if (options.cookies) args.push('--cookies', options.cookies)
    if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser)
    args.push(url)
    const { stdout } = await this._execute(bin, args, this.baseDir)
    return JSON.parse(stdout)
  }

  async download(url, options = {}) {
    await this._ensureDependencies()
    const isGallery = this._isGalleryUrl(url)
    const isTiktok = /tiktok\.com|vt\.tiktok\.com/i.test(url)
    let bin = isGallery ? this.galleryDlBin : this.ytDlpBin
    
    const outputDir = options.outputDir || path.join(this.baseDir, `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
    await this._ensureDir(outputDir)
    
    const buildArgs = (targetBin) => {
      const args = []
      if (options.cookies) args.push('--cookies', options.cookies)
      if (options.cookiesFromBrowser) args.push('--cookies-from-browser', options.cookiesFromBrowser)
      
      if (targetBin === this.galleryDlBin) {
        args.push('--directory', outputDir, '--quiet')
        if (options.filenameFormat) args.push('-f', options.filenameFormat)
        if (options.limitRate) args.push('-r', options.limitRate)
        if (options.maxFilesize) args.push('--filesize-max', options.maxFilesize)
        if (options.sleepRequest) args.push('--sleep-request', options.sleepRequest.toString())
        if (options.writeInfoJson) args.push('--write-info-json')
      } else {
        const format = options.format || 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        args.push('-f', format)
        args.push('-o', path.join(outputDir, options.filenameFormat || '%(title).50s.%(ext)s'))
        args.push('--no-playlist')
        args.push('--merge-output-format', 'mp4')
        if (options.limitRate) args.push('--limit-rate', options.limitRate)
        if (options.maxFilesize) args.push('--max-filesize', options.maxFilesize)
        if (options.sleepRequest) args.push('--sleep-requests', options.sleepRequest.toString())
        if (options.writeInfoJson) args.push('--write-info-json')
        if (options.audioOnly) args.push('-x', '--audio-format', options.audioFormat || 'mp3')
      }
      args.push(url)
      return args
    }

    let args = buildArgs(bin)
    
    try {
      await this._execute(bin, args, this.baseDir)
    } catch (err) {
      if (isTiktok && bin === this.ytDlpBin) {
        bin = this.galleryDlBin
        args = buildArgs(bin)
        await this._execute(bin, args, this.baseDir)
      } else {
        throw err
      }
    }
    
    const files = await this._readDirRecursive(outputDir)
    return { directory: outputDir, files }
  }

  async _readDirRecursive(dir) {
    try {
      const dirents = await fs.readdir(dir, { withFileTypes: true })
      const files = await Promise.all(dirents.map(async (dirent) => {
        const res = path.resolve(dir, dirent.name)
        return dirent.isDirectory() ? this._readDirRecursive(res) : res
      }))
      return files.flat()
    } catch { return [] }
  }

  async cleanup(dir) {
    await fs.rm(dir, { recursive: true, force: true })
  }
}

module.exports = new MediaDownloader()
