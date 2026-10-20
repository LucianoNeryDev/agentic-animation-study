import bpy
p = bpy.context.preferences.addons['cycles'].preferences
p.compute_device_type = 'CUDA'
p.get_devices()
for d in p.devices: d.use = (d.type == 'CUDA')
s = bpy.context.scene
s.render.engine = 'CYCLES'; s.cycles.device = 'GPU'; s.cycles.samples = 16
print('USING', [d.name for d in p.devices if d.use])
