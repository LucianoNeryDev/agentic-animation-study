# Like gpu.py, but renders on the CPU threads as well as the GPU
import bpy
p = bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type = 'CUDA'
p.get_devices()
for d in p.devices: d.use = d.type in ('CUDA', 'CPU')
s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.device = 'GPU'
print('USING', [d.name for d in p.devices if d.use])
