extends Node3D
# "Arena": a hero clears a ring of slimes. Every move is a function of game
# time, so Movie Maker records the same frames on every run. Hit-stop freezes
# game time and physics while real frames keep recording.

const FPS := 60.0
# Beat sheet, in game seconds. Hit-stop frames are added on top.
const T_SPAWN := 0.15
const T_ADVANCE := 1.0
const T_CLOSE := 1.8
const STRIKES := [2.0, 2.4, 2.8]
const STRIKE_ANGLES := [20.0, 160.0, 90.0]   # which slime each strike targets
const T_CROUCH := 3.05
const T_JUMP := 3.2
const T_APEX := 3.46
const SLAM := 3.6
const T_FACE := 4.7
const T_END := 6.8
const HITSTOP_STRIKE := 4
const HITSTOP_SLAM := 9
const TOTAL_FRAMES := 429   # T_END * FPS + 3 * HITSTOP_STRIKE + HITSTOP_SLAM

const R := 0.42             # slime radius
const N_RING := 18
const APEX_H := 3.4

var rng := RandomNumberGenerator.new()
var gf := -1                # game frame; frozen during hit-stop
var gt := 0.0
var hitstop := 0
var trauma := 0.0
var real_frame := 0
var pending: Array = []     # launches applied when the hit-stop ends
var fired := {}

var enemies: Array = []
var plan: Array = []
var hero: Node3D
var rig: Node3D
var sword: Node3D
var hero_light: OmniLight3D
var slash: MeshInstance3D
var slash_mat: ShaderMaterial
var slash_age := 99
var shock: MeshInstance3D
var shock_mat: StandardMaterial3D
var sparks: Array = []
var dust: GPUParticles3D
var cam: Camera3D
var cam_look := Vector3(0, 0.6, 0)
var flash: ColorRect
var flash_a := 0.0
var combo_label: Label
var combo_sub: Label
var combo := 0
var combo_pop := 0.0
var slam_counted := false


func _ready() -> void:
	rng.seed = 42
	build_world()
	build_hero()
	build_enemies()
	build_fx()
	build_ui()
	make_plan()
	print("ARENA renderer=", RenderingServer.get_video_adapter_name(), " frames=", TOTAL_FRAMES)


# ---------------------------------------------------------------- building

func mat(color: Color, rough := 0.5, emit := Color.BLACK, energy := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	if energy > 0.0:
		m.emission_enabled = true
		m.emission = emit
		m.emission_energy_multiplier = energy
	return m


func mesh_node(mesh: Mesh, material: Material, parent: Node, pos := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = material
	mi.position = pos
	parent.add_child(mi)
	return mi


func build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#06080f")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#5a6a9a")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_AGX
	env.glow_enabled = true
	env.glow_intensity = 0.7
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.95
	env.ssao_enabled = true
	env.fog_enabled = true
	env.fog_light_color = Color("#141a2e")
	env.fog_density = 0.018
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-58, 35, 0)
	sun.light_color = Color("#ffe6cc")
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)

	# floor: glowing grid that fades toward the walls
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
uniform vec3 base : source_color = vec3(0.035, 0.04, 0.06);
uniform vec3 line : source_color = vec3(0.2, 0.45, 0.85);
void fragment() {
	vec2 p = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xz;
	vec2 g = abs(fract(p * 0.5 - 0.5) - 0.5) / fwidth(p * 0.5);
	float l = 1.0 - min(min(g.x, g.y), 1.0);
	float r = length(p);
	float ring = 1.0 - smoothstep(0.0, 0.06, abs(r - 10.4));
	ALBEDO = base;
	ROUGHNESS = 0.55;
	EMISSION = line * (l * 0.55 * smoothstep(12.0, 3.0, r) + ring * 2.5);
}
"""
	var fm := ShaderMaterial.new()
	fm.shader = sh
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(60, 60)
	mesh_node(floor_mesh, fm, self)
	var floor_body := StaticBody3D.new()
	var fshape := CollisionShape3D.new()
	var fbox := BoxShape3D.new()
	fbox.size = Vector3(60, 1, 60)
	fshape.shape = fbox
	fshape.position.y = -0.5
	floor_body.add_child(fshape)
	add_child(floor_body)

	# ring wall: 28 low segments with a glowing top strip
	var wall_mat := mat(Color("#1a2033"), 0.7)
	var strip_mat := mat(Color("#ff3d7f"), 0.4, Color("#ff3d7f"), 1.3)
	var n := 28
	var radius := 11.0
	var seg_len := 2.0 * PI * radius / n + 0.05
	for i in n:
		var a := TAU * i / n
		var wb := StaticBody3D.new()
		wb.position = Vector3(cos(a) * radius, 0.45, sin(a) * radius)
		wb.rotation.y = -a + PI / 2.0
		var box := BoxMesh.new()
		box.size = Vector3(seg_len, 0.9, 0.5)
		mesh_node(box, wall_mat, wb)
		var strip := BoxMesh.new()
		strip.size = Vector3(seg_len, 0.04, 0.52)
		mesh_node(strip, strip_mat, wb, Vector3(0, 0.46, 0))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(seg_len, 8.0, 0.5)   # taller than it looks, so slimes stay in
		cs.shape = bs
		cs.position.y = 3.5
		wb.add_child(cs)
		add_child(wb)


func build_hero() -> void:
	hero = Node3D.new()
	add_child(hero)
	rig = Node3D.new()   # squash and stretch pivot at the feet
	hero.add_child(rig)
	var body := CapsuleMesh.new()
	body.radius = 0.42
	body.height = 1.7
	mesh_node(body, mat(Color("#e8eef8"), 0.35), rig, Vector3(0, 0.85, 0))
	var visor := BoxMesh.new()
	visor.size = Vector3(0.62, 0.14, 0.2)
	mesh_node(visor, mat(Color("#40e0ff"), 0.2, Color("#40e0ff"), 4.0), rig, Vector3(0, 1.32, -0.32))
	var belt := CylinderMesh.new()
	belt.top_radius = 0.45
	belt.bottom_radius = 0.45
	belt.height = 0.1
	mesh_node(belt, mat(Color("#2a3150"), 0.6), rig, Vector3(0, 0.8, 0))
	sword = Node3D.new()
	sword.position = Vector3(0.5, 0.95, 0)
	rig.add_child(sword)
	var blade := BoxMesh.new()
	blade.size = Vector3(0.07, 0.07, 1.6)
	mesh_node(blade, mat(Color("#bff8ff"), 0.2, Color("#7ff0ff"), 6.0), sword, Vector3(0, 0, -0.85))
	var hilt := BoxMesh.new()
	hilt.size = Vector3(0.32, 0.08, 0.08)
	mesh_node(hilt, mat(Color("#ffd34d"), 0.3), sword, Vector3(0, 0, -0.05))
	hero_light = OmniLight3D.new()
	hero_light.light_color = Color("#40e0ff")
	hero_light.light_energy = 1.6
	hero_light.omni_range = 4.0
	add_child(hero_light)


func build_enemies() -> void:
	var sphere := SphereMesh.new()
	sphere.radius = R
	sphere.height = R * 2.0
	var eye := SphereMesh.new()
	eye.radius = 0.1
	eye.height = 0.2
	var pupil := SphereMesh.new()
	pupil.radius = 0.05
	pupil.height = 0.1
	var white := mat(Color.WHITE, 0.3)
	var black := mat(Color("#101018"), 0.3)
	var pm := PhysicsMaterial.new()
	pm.bounce = 0.35
	pm.friction = 0.7
	var all := []
	for ring in 2:
		for i in N_RING:
			var a := TAU * (i + 0.5 * ring) / N_RING
			all.append({"angle": a, "ring": ring})
	all.sort_custom(func(p, q): return fposmod(p.angle + 1.2, TAU) < fposmod(q.angle + 1.2, TAU))
	for idx in all.size():
		var e: Dictionary = all[idx]
		var body := RigidBody3D.new()
		body.freeze = true
		body.freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
		body.physics_material_override = pm
		body.continuous_cd = true
		body.linear_damp = 0.15
		body.angular_damp = 0.4
		var cs := CollisionShape3D.new()
		var ss := SphereShape3D.new()
		ss.radius = R
		cs.shape = ss
		body.add_child(cs)
		var vis := Node3D.new()
		body.add_child(vis)
		var m := mat(Color("#e8365f") if e.ring == 0 else Color("#c22a8a"), 0.28)
		m.rim_enabled = true
		m.rim = 0.6
		m.clearcoat_enabled = true
		m.clearcoat = 0.7
		mesh_node(sphere, m, vis)
		for side in [-1.0, 1.0]:
			mesh_node(eye, white, vis, Vector3(side * 0.15, 0.12, -0.33))
			mesh_node(pupil, black, vis, Vector3(side * 0.15, 0.12, -0.42))
		add_child(body)
		body.position = Vector3(0, -5, 0)
		e.body = body
		e.vis = vis
		e.mat = m
		e.base = m.albedo_color
		e.order = idx
		e.r0 = 6.6 if e.ring == 0 else 8.4
		e.r1 = 3.4 if e.ring == 0 else 4.9
		e.phase = rng.randf()
		e.launched = false
		e.flash = 0
		enemies.append(e)


func build_fx() -> void:
	# slash smear: an arc drawn by a shader on a flat quad around the hero
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
uniform float fade = 1.0;
uniform vec3 col : source_color = vec3(0.55, 0.95, 1.0);
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float a = atan(p.x, -p.y);          // 0 = forward, + = right
	float band = smoothstep(0.45, 0.7, r) * (1.0 - smoothstep(0.9, 1.0, r));
	float arc = smoothstep(2.2, 1.6, a) * smoothstep(-1.6, -1.2, a);
	float lead = mix(0.25, 1.0, smoothstep(2.2, -1.4, a));
	float v = band * arc * lead * fade;
	ALBEDO = col * v * 3.0;
	ALPHA = clamp(v, 0.0, 1.0);
}
"""
	slash_mat = ShaderMaterial.new()
	slash_mat.shader = sh
	var q := QuadMesh.new()
	q.size = Vector2(4.4, 4.4)
	slash = mesh_node(q, slash_mat, self)
	slash.visible = false

	var torus := TorusMesh.new()
	torus.inner_radius = 0.92
	torus.outer_radius = 1.0
	torus.rings = 96
	shock_mat = StandardMaterial3D.new()
	shock_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	shock_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	shock_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	shock_mat.albedo_color = Color(0.6, 0.95, 1.0, 1.0)
	shock = mesh_node(torus, shock_mat, self, Vector3(0, 0.08, 0))
	shock.visible = false

	var spark_mat := mat(Color("#ffb347"), 0.5, Color("#ffa040"), 8.0)
	var spark_mesh := SphereMesh.new()
	spark_mesh.radius = 0.045
	spark_mesh.height = 0.09
	spark_mesh.radial_segments = 6
	spark_mesh.rings = 3
	spark_mesh.material = spark_mat
	var shrink := Curve.new()
	shrink.add_point(Vector2(0, 1))
	shrink.add_point(Vector2(1, 0))
	var shrink_tex := CurveTexture.new()
	shrink_tex.curve = shrink
	for i in 4:
		var pm := ParticleProcessMaterial.new()
		pm.direction = Vector3(0, 1, 0)
		pm.spread = 75.0
		pm.initial_velocity_min = 5.0 if i < 3 else 8.0
		pm.initial_velocity_max = 11.0 if i < 3 else 17.0
		pm.gravity = Vector3(0, -14, 0)
		pm.scale_min = 0.6
		pm.scale_max = 1.6
		pm.scale_curve = shrink_tex
		pm.damping_min = 2.0
		pm.damping_max = 5.0
		var p := GPUParticles3D.new()
		p.amount = 48 if i < 3 else 160
		p.lifetime = 0.55 if i < 3 else 0.9
		p.one_shot = true
		p.explosiveness = 1.0
		p.fixed_fps = 60
		p.local_coords = false
		p.use_fixed_seed = true
		p.seed = 7 + i
		p.process_material = pm
		p.draw_pass_1 = spark_mesh
		p.emitting = false
		add_child(p)
		sparks.append(p)

	var dpm := ParticleProcessMaterial.new()
	dpm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_RING
	dpm.emission_ring_axis = Vector3(0, 1, 0)
	dpm.emission_ring_radius = 1.2
	dpm.emission_ring_inner_radius = 0.9
	dpm.emission_ring_height = 0.1
	dpm.direction = Vector3(0, 1, 0)
	dpm.spread = 20.0
	dpm.initial_velocity_min = 0.5
	dpm.initial_velocity_max = 1.5
	dpm.radial_velocity_min = 5.0
	dpm.radial_velocity_max = 9.0
	dpm.damping_min = 5.0
	dpm.damping_max = 8.0
	dpm.gravity = Vector3(0, 0.3, 0)
	dpm.scale_min = 0.6
	dpm.scale_max = 1.4
	var grow := Curve.new()
	grow.add_point(Vector2(0, 0.4))
	grow.add_point(Vector2(0.3, 1.0))
	grow.add_point(Vector2(1, 0))
	var grow_tex := CurveTexture.new()
	grow_tex.curve = grow
	dpm.scale_curve = grow_tex
	var puff := SphereMesh.new()
	puff.radius = 0.35
	puff.height = 0.7
	var puff_mat := StandardMaterial3D.new()
	puff_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	puff_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	puff_mat.albedo_color = Color(0.55, 0.6, 0.75, 0.22)
	puff.material = puff_mat
	dust = GPUParticles3D.new()
	dust.amount = 90
	dust.lifetime = 1.1
	dust.one_shot = true
	dust.explosiveness = 1.0
	dust.fixed_fps = 60
	dust.local_coords = false
	dust.use_fixed_seed = true
	dust.seed = 99
	dust.process_material = dpm
	dust.draw_pass_1 = puff
	dust.emitting = false
	add_child(dust)

	cam = Camera3D.new()
	cam.fov = 46
	add_child(cam)


func build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	flash = ColorRect.new()
	flash.color = Color(1, 1, 1, 0)
	flash.size = Vector2(1920, 1080)
	layer.add_child(flash)
	var big := LabelSettings.new()
	big.font_size = 132
	big.font_color = Color("#ffd34d")
	big.outline_size = 28
	big.outline_color = Color("#0d1020")
	combo_label = Label.new()
	combo_label.label_settings = big
	combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	combo_label.position = Vector2(1240, 50)
	combo_label.size = Vector2(600, 170)
	combo_label.pivot_offset = Vector2(600, 85)
	combo_label.modulate.a = 0.0
	layer.add_child(combo_label)
	var small := LabelSettings.new()
	small.font_size = 44
	small.font_color = Color("#ffffff")
	small.outline_size = 14
	small.outline_color = Color("#0d1020")
	combo_sub = Label.new()
	combo_sub.label_settings = small
	combo_sub.text = "C O M B O"
	combo_sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	combo_sub.position = Vector2(1240, 210)
	combo_sub.size = Vector2(590, 60)
	combo_sub.modulate.a = 0.0
	layer.add_child(combo_sub)


func make_plan() -> void:
	var prev := Vector3.ZERO
	for k in STRIKES.size():
		var t: float = STRIKES[k]
		var want := deg_to_rad(STRIKE_ANGLES[k])
		var best: Dictionary = {}
		var best_d := 99.0
		for e in enemies:
			var d := absf(angle_difference(e.angle, want))
			if e.ring == 0 and d < best_d:
				best_d = d
				best = e
		var ep := enemy_pos(best, t)
		ep.y = 0
		var dir := (ep - prev).normalized()
		var to := ep - dir * 1.05
		plan.append({"t": t, "e": best, "from": prev, "to": to, "dir": dir})
		prev = to


# ---------------------------------------------------------------- timing

func _process(_delta: float) -> void:
	if hitstop > 0:
		hitstop -= 1
		if hitstop == 0:
			Engine.time_scale = 1.0
			for p in pending:
				launch(p[0], p[1], p.size() > 2)
			pending.clear()
	else:
		gf += 1
	gt = gf / FPS
	fire_events()
	update_hero()
	update_enemies()
	update_fx()
	update_camera()
	real_frame += 1


func at(t: float) -> bool:
	# true once, on the first game frame at or after t
	var f := int(round(t * FPS))
	if gf >= f and not fired.has(f):
		fired[f] = true
		return true
	return false


func start_hitstop(frames: int) -> void:
	hitstop = frames
	Engine.time_scale = 0.0


func fire_events() -> void:
	for s in plan:
		if at(s.t):
			var e: Dictionary = s.e
			e.launched = true
			e.flash = HITSTOP_STRIKE + 2
			var v: Vector3 = s.dir * 10.0 + Vector3(0, 4.5, 0)
			pending.append([e, v])
			start_hitstop(HITSTOP_STRIKE)
			trauma = minf(1.0, trauma + 0.45)
			slash_age = 0
			slash.global_position = hero.global_position + Vector3(0, 0.95, 0)
			slash.rotation = Vector3(-PI / 2.0, 0, 0)
			slash.rotate_y(hero.rotation.y)
			var sp: GPUParticles3D = sparks[plan.find(s)]
			sp.global_position = e.body.global_position + Vector3(0, 0.2, 0)
			sp.restart()
			combo += 1
			combo_pop = 1.0
	if at(SLAM):
		for e in enemies:
			var p: Vector3 = e.body.global_position
			var flat := Vector3(p.x, 0, p.z)
			var d := flat.length()
			if d > 8.0:
				continue
			var out := flat.normalized() if d > 0.01 else Vector3.FORWARD
			var speed := lerpf(13.0, 6.0, clampf((d - 2.0) / 5.0, 0.0, 1.0))
			var v := out * speed + Vector3(0, 3.5 + rng.randf() * 2.5, 0)
			if e.launched:
				pending.append([e, v * 0.6, true])
			else:
				e.launched = true
				pending.append([e, v])
			e.flash = 5
		start_hitstop(HITSTOP_SLAM)
		trauma = 1.0
		flash_a = 0.6
		shock.visible = true
		sparks[3].global_position = Vector3(0, 0.3, 0)
		sparks[3].restart()
		dust.global_position = Vector3(0, 0.15, 0)
		dust.restart()


func launch(e: Dictionary, v: Vector3, add := false) -> void:
	var b: RigidBody3D = e.body
	b.freeze = false
	b.linear_velocity = (b.linear_velocity + v) if add else v
	b.angular_velocity = Vector3(rng.randf_range(-12, 12), rng.randf_range(-6, 6), rng.randf_range(-12, 12))


# ---------------------------------------------------------------- motion

func ease_out(u: float) -> float:
	return 1.0 - (1.0 - u) * (1.0 - u)


func ease_back(u: float) -> float:
	var c := 1.9
	return 1.0 + (c + 1.0) * pow(u - 1.0, 3) + c * pow(u - 1.0, 2)


func spawn_time(e: Dictionary) -> float:
	return T_SPAWN + e.order * 0.022


func enemy_pos(e: Dictionary, t: float) -> Vector3:
	var u := clampf((t - T_ADVANCE) / (T_CLOSE - T_ADVANCE), 0.0, 1.0)
	var r: float = lerpf(e.r0, e.r1, smoothstep(0.0, 1.0, u))
	var y := R
	if u > 0.0 and u < 1.0:
		var env := smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u)
		y += absf(sin((u * 4.0 + e.phase) * PI)) * 0.5 * env
	var ts := spawn_time(e)
	if t < ts + 0.3:
		y = lerpf(2.6, R, clampf((t - ts) / 0.3, 0.0, 1.0) ** 2)
	return Vector3(cos(e.angle) * r, y, sin(e.angle) * r)


func update_enemies() -> void:
	for e in enemies:
		var vis: Node3D = e.vis
		var m: StandardMaterial3D = e.mat
		if e.flash > 0:
			m.albedo_color = Color.WHITE
			m.emission_enabled = true
			m.emission = Color.WHITE
			m.emission_energy_multiplier = 2.0
			e.flash -= 1
		else:
			m.albedo_color = e.base
			m.emission_enabled = false
		if e.launched:
			vis.scale = vis.scale.lerp(Vector3.ONE, 0.2)
			continue
		var b: RigidBody3D = e.body
		var p := enemy_pos(e, gt)
		b.global_position = p
		var look := Vector3(hero.position.x, p.y, hero.position.z)
		if look.distance_to(p) > 0.1:
			b.look_at(look, Vector3.UP)
		# pop in, then squash on the ground and stretch in the air
		var ts := spawn_time(e)
		var s := 0.0
		if gt >= ts:
			s = ease_back(clampf((gt - ts) / 0.28, 0.0, 1.0))
		var air := clampf((p.y - R) / 0.5, 0.0, 1.0)
		var sy := lerpf(0.82, 1.12, air) + 0.04 * sin(gt * 7.0 + e.phase * TAU)
		vis.scale = Vector3(s / sqrt(sy), s * sy, s / sqrt(sy))
		vis.position.y = (sy - 1.0) * R * s


func yaw_of(d: Vector3) -> float:
	return atan2(-d.x, -d.z)


func update_hero() -> void:
	var t := gt
	var pos := Vector3.ZERO
	var yaw := yaw_of(Vector3(0, 0, 1))
	var squash := 1.0 + 0.03 * sin(t * 5.0)
	var swing := -1.0   # <0: sword at rest; 0..1: horizontal slash
	var raise := 0.0    # 0: rest; 1: overhead
	var done := true
	for s in plan:
		var d: Vector3 = s.dir
		if t < s.t - 0.16:
			pos = s.from
			var prev_yaw := yaw if plan.find(s) == 0 else yaw_of(plan[plan.find(s) - 1].dir)
			yaw = lerp_angle(prev_yaw, yaw_of(d), smoothstep(s.t - 0.4, s.t - 0.25, t))
			done = false
			break
		elif t < s.t - 0.07:
			var u: float = (t - (s.t - 0.16)) / 0.09
			pos = s.from - d * 0.3 * ease_out(u)
			yaw = yaw_of(d)
			squash = 1.0 - 0.2 * ease_out(u)
			swing = 0.0
			done = false
			break
		elif t < s.t:
			var u: float = (t - (s.t - 0.07)) / 0.07
			pos = (s.from - d * 0.3).lerp(s.to, u * u)
			yaw = yaw_of(d)
			squash = 1.15
			swing = 0.6 * u
			done = false
			break
		elif t < s.t + 0.25:
			var u: float = (t - s.t) / 0.25
			pos = s.to + d * 0.3 * sin(u * PI) * (1.0 - u)
			yaw = yaw_of(d)
			squash = lerpf(0.88, 1.0, ease_out(u))
			swing = minf(1.0, 0.6 + u * 3.0) if u < 0.6 else -1.0
			done = false
			break
		else:
			pos = s.to
			yaw = yaw_of(d)
	if done and t >= T_CROUCH:
		var p3: Vector3 = plan[-1].to
		var to_c := yaw_of(-p3)
		if t < T_JUMP:
			var u := (t - T_CROUCH) / (T_JUMP - T_CROUCH)
			pos = p3
			yaw = lerp_angle(yaw_of(plan[-1].dir), to_c, ease_out(u))
			squash = 1.0 - 0.32 * ease_out(u)
			raise = ease_out(u)
		elif t < T_APEX:
			var u := (t - T_JUMP) / (T_APEX - T_JUMP)
			pos = p3.lerp(Vector3.ZERO, ease_out(u))
			pos.y = APEX_H * ease_out(u)
			yaw = to_c
			squash = lerpf(1.25, 1.0, u)
			raise = 1.0
		elif t < SLAM - 0.08:
			pos = Vector3(0, APEX_H + 0.1 * sin((t - T_APEX) / 0.06 * PI * 0.5), 0)
			yaw = to_c
			raise = 1.0
		elif t < SLAM:
			var u := (t - (SLAM - 0.08)) / 0.08
			pos = Vector3(0, (APEX_H + 0.1) * (1.0 - u * u), 0)
			yaw = to_c
			squash = 1.3
			raise = 1.0 - u
		else:
			var u := clampf((t - SLAM) / 0.55, 0.0, 1.0)
			pos = Vector3.ZERO
			yaw = lerp_angle(to_c, yaw_of(Vector3(0, 0, 1)), smoothstep(T_FACE, T_FACE + 0.45, t))
			squash = lerpf(0.62, 1.0, ease_back(u)) + 0.03 * sin(t * 5.0) * u
			raise = 0.0
	hero.position = pos
	hero.rotation.y = yaw
	rig.scale = Vector3(1.0 / sqrt(squash), squash, 1.0 / sqrt(squash))
	if swing >= 0.0:
		sword.rotation = Vector3(-0.15, lerpf(-2.1, 1.5, swing), 0)
	else:
		sword.rotation = Vector3(lerpf(-0.35, 1.5, raise), lerpf(-0.5, 0.0, raise), 0)
	hero_light.position = pos + Vector3(0, 1.2, 0)


func update_fx() -> void:
	if slash_age < 12:
		slash.visible = true
		slash_mat.set_shader_parameter("fade", 1.0 - slash_age / 12.0)
		slash_age += 1
	else:
		slash.visible = false
	if shock.visible:
		var u := clampf((gt - SLAM) / 0.7, 0.0, 1.0)
		var s := lerpf(1.2, 13.0, ease_out(u))
		shock.scale = Vector3(s, 1.0, s)
		shock_mat.albedo_color.a = 1.0 - u
		shock.visible = u < 1.0
	flash.color.a = flash_a
	flash_a = maxf(0.0, flash_a - 0.09)
	# combo counter: counts up through the slam
	if gt > SLAM and not slam_counted:
		var u := clampf((gt - SLAM) / 0.4, 0.0, 1.0)
		var n := int(lerpf(STRIKES.size(), enemies.size(), u))
		if n != combo:
			combo = n
			combo_pop = maxf(combo_pop, 0.5)
		if u >= 1.0:
			slam_counted = true
			combo_pop = 1.0
	if combo > 0:
		combo_label.text = ("%d HIT" if combo == 1 else "%d HITS") % combo
		combo_label.modulate.a = minf(1.0, combo_label.modulate.a + 0.25)
		combo_sub.modulate.a = combo_label.modulate.a
		combo_label.scale = Vector2.ONE * (1.0 + 0.35 * combo_pop * combo_pop)
		combo_pop = maxf(0.0, combo_pop - 0.08)


func update_camera() -> void:
	var push := smoothstep(SLAM + 0.2, 6.0, gt)
	var yaw := deg_to_rad(lerpf(-16.0, 14.0, smoothstep(0.0, T_END, gt)))
	var dist := lerpf(12.5, 8.5, push)
	var height := lerpf(8.5, 4.2, push)
	var want := hero.position * 0.45 + Vector3(0, 0.6 + hero.position.y * 0.3, 0)
	want = want.lerp(Vector3(0, 1.1, 0), push)
	cam_look = cam_look.lerp(want, 0.15)
	cam.position = cam_look + Vector3(sin(yaw) * dist, height, cos(yaw) * dist)
	cam.look_at(cam_look, Vector3.UP)
	var k := trauma * trauma
	var f := float(real_frame)
	cam.position += cam.basis.x * k * 0.55 * (sin(f * 1.7) + 0.5 * sin(f * 3.9 + 1.0))
	cam.position += cam.basis.y * k * 0.45 * (sin(f * 2.3 + 2.0) + 0.5 * sin(f * 4.7))
	cam.rotate_object_local(Vector3.FORWARD, k * 0.035 * sin(f * 2.9 + 0.5))
	trauma = maxf(0.0, trauma - 1.0 / (0.45 * FPS))
