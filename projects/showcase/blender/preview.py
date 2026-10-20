# Fast preview settings; pass after gpu.py: blender -b scene.blend -P gpu.py -P preview.py ...
import bpy
s = bpy.context.scene
s.render.resolution_percentage = 50
s.cycles.samples = 24
s.render.use_motion_blur = False
