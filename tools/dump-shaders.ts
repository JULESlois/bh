import { VERT, SCENE_FRAG, BRIGHT_FRAG, BLUR_FRAG, COMPOSITE_FRAG } from '../src/gl/shaders'
import { writeFileSync } from 'node:fs'
writeFileSync('/tmp/bh_vert.vert', VERT)
writeFileSync('/tmp/bh_scene.frag', SCENE_FRAG)
writeFileSync('/tmp/bh_bright.frag', BRIGHT_FRAG)
writeFileSync('/tmp/bh_blur.frag', BLUR_FRAG)
writeFileSync('/tmp/bh_comp.frag', COMPOSITE_FRAG)
console.log('dumped')
