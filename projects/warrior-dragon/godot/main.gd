# Warrior vs Dragon, Godot 2D: draws the shapes baked by ../choreo.py (bake.json)
# and adds the game layer: dusk parallax world, HDR glow, particle fire, sparks,
# dust, smoke and embers, hit-flash, damage numbers, health and boss bars.
#   godot --path . --write-movie renders/frames/f.png --fixed-fps 60 --quit-after 1200
extends Node2D

var B: Dictionary
var DATA: Array
var EVENTS: Array
var PX: float
var frame := 0
var fr: Dictionary

var actors: Node2D
var fx: Node2D
var cam: Camera2D
var font: SystemFont
var breath: GPUParticles2D
var blast: GPUParticles2D
var splash: GPUParticles2D
var smoke: GPUParticles2D
var bursts := {}            # event index -> GPUParticles2D
var hp_w: ColorRect
var hp_w_chip: ColorRect
var hp_d: ColorRect
var hp_d_chip: ColorRect
var boss_box: Control
var banner: Label
var flash: ColorRect

const STEEL := Color(0.62, 0.66, 0.74)
const STEEL_DARK := Color(0.30, 0.33, 0.40)
const BODY := Color(0.10, 0.11, 0.16)
const CAPE := Color(0.72, 0.08, 0.12)
const CAPE_IN := Color(0.42, 0.04, 0.08)
const WOOD := Color(0.48, 0.28, 0.12)
const GOLD := Color(1.0, 0.75, 0.25)
const D_BODY := Color(0.62, 0.12, 0.10)
const D_DARK := Color(0.36, 0.05, 0.06)
const D_BELLY := Color(0.92, 0.62, 0.30)
const D_WING := Color(0.50, 0.08, 0.10, 0.92)
const IVORY := Color(0.95, 0.90, 0.78)
const BAR_W := 560.0


func _ready() -> void:
	B = JSON.parse_string(FileAccess.get_file_as_string("res://bake.json"))
	DATA = B["data"]
	EVENTS = B["events"]
	PX = B["px"]
	fr = DATA[0]
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Noto Sans"])
	font.font_weight = 900
	build_world()
	build_particles()
	build_hud()
	print("WARRIOR-DRAGON renderer=", RenderingServer.get_video_adapter_name(), " frames=", DATA.size())


func P(a) -> Vector2:
	return Vector2(a[0] * PX, -a[1] * PX)


func PA(arr) -> PackedVector2Array:
	var out := PackedVector2Array()
	for a in arr:
		out.append(P(a))
	return out


# ---------------------------------------------------------------- world

func poly(parent: Node, pts: PackedVector2Array, color: Color) -> Polygon2D:
	var p := Polygon2D.new()
	p.polygon = pts
	p.color = color
	parent.add_child(p)
	return p


func build_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_CANVAS
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_hdr_threshold = 1.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SCREEN
	for level in [5, 6]:
		env.set_glow_level(level, 0.0)
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)

	var sky_layer := CanvasLayer.new()
	sky_layer.layer = -10
	add_child(sky_layer)
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.55, 0.82, 1.0])
	g.colors = PackedColorArray([Color(0.07, 0.05, 0.16), Color(0.34, 0.12, 0.30), Color(0.86, 0.38, 0.24), Color(1.0, 0.66, 0.36)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0)
	gt.fill_to = Vector2(0, 1)
	var sky := TextureRect.new()
	sky.texture = gt
	sky.size = Vector2(1920, 1080)
	sky_layer.add_child(sky)

	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	# sun, nearly fixed
	var sun_layer := Parallax2D.new()
	sun_layer.scroll_scale = Vector2(0.05, 1.0)
	add_child(sun_layer)
	var sun := PackedVector2Array()
	for k in 48:
		sun.append(Vector2(760, -300) + Vector2(cos(k / 48.0 * TAU), sin(k / 48.0 * TAU)) * 95)
	poly(sun_layer, sun, Color(1.45, 0.72, 0.38))
	# far mountains
	var far := Parallax2D.new()
	far.scroll_scale = Vector2(0.18, 1.0)
	add_child(far)
	var m := PackedVector2Array([Vector2(-4000, 200)])
	var x := -4000.0
	while x < 5000.0:
		m.append(Vector2(x, -rng.randf_range(150, 330)))
		x += rng.randf_range(160, 380)
	m.append(Vector2(5000, 200))
	poly(far, m, Color(0.24, 0.11, 0.24))
	# ruins on mid hills
	var mid := Parallax2D.new()
	mid.scroll_scale = Vector2(0.45, 1.0)
	add_child(mid)
	var h := PackedVector2Array([Vector2(-4000, 200)])
	x = -4000.0
	while x < 5000.0:
		h.append(Vector2(x, -60 - 40 * sin(x * 0.0021) - rng.randf_range(0, 25)))
		x += 120.0
	h.append(Vector2(5000, 200))
	poly(mid, h, Color(0.14, 0.06, 0.13))
	for tx in [-1500.0, -1180.0, 900.0, 1350.0, 1650.0]:
		var tw := rng.randf_range(70, 120)
		var th := rng.randf_range(160, 280)
		var base_y := -60 - 40 * sin(tx * 0.0021)
		var tower := PackedVector2Array([Vector2(tx, base_y + 20), Vector2(tx, base_y - th), Vector2(tx + tw * 0.3, base_y - th - 30),
			Vector2(tx + tw * 0.5, base_y - th + 10), Vector2(tx + tw * 0.75, base_y - th - 20), Vector2(tx + tw, base_y - th + 25), Vector2(tx + tw, base_y + 20)])
		poly(mid, tower, Color(0.11, 0.04, 0.10))
		var win := PackedVector2Array([Vector2(tx + tw * 0.4, base_y - th * 0.6), Vector2(tx + tw * 0.6, base_y - th * 0.6),
			Vector2(tx + tw * 0.6, base_y - th * 0.45), Vector2(tx + tw * 0.4, base_y - th * 0.45)])
		poly(mid, win, Color(1.6, 0.7, 0.25))
	# ground
	poly(self, PackedVector2Array([Vector2(-5000, 0), Vector2(6000, 0), Vector2(6000, 1200), Vector2(-5000, 1200)]), Color(0.09, 0.05, 0.07))
	var rim := Line2D.new()
	rim.points = PackedVector2Array([Vector2(-5000, 0), Vector2(6000, 0)])
	rim.width = 4
	rim.default_color = Color(1.1, 0.5, 0.25)
	add_child(rim)
	for i in 160:
		var rx := rng.randf_range(-4500, 5500)
		var ry := rng.randf_range(4, 160)
		var s := rng.randf_range(8, 26) * (0.6 + ry / 160.0)
		poly(self, PackedVector2Array([Vector2(rx - s, ry), Vector2(rx - s * 0.4, ry - s * 0.6), Vector2(rx + s * 0.5, ry - s * 0.5), Vector2(rx + s, ry)]),
			Color(0.16, 0.08, 0.10).lerp(Color(0.05, 0.02, 0.04), ry / 160.0))
	for i in 120:
		var gx := rng.randf_range(-4500, 5500)
		var tuft := Line2D.new()
		tuft.points = PackedVector2Array([Vector2(gx, 2), Vector2(gx + rng.randf_range(-8, 8), -rng.randf_range(10, 24))])
		tuft.width = 3
		tuft.default_color = Color(0.30, 0.16, 0.12)
		add_child(tuft)

	actors = Node2D.new()
	actors.draw.connect(draw_actors)
	add_child(actors)
	fx = Node2D.new()
	fx.draw.connect(draw_fx)
	add_child(fx)
	cam = Camera2D.new()
	add_child(cam)
	cam.make_current()


# ---------------------------------------------------------------- particles

func dot_texture() -> GradientTexture2D:
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = 64
	t.height = 64
	return t


func ramp(offsets: Array, colors: Array) -> GradientTexture1D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array(offsets)
	g.colors = PackedColorArray(colors)
	var t := GradientTexture1D.new()
	t.gradient = g
	return t


func emitter(amount: int, life: float, seed_: int, pm: ParticleProcessMaterial, one_shot: bool) -> GPUParticles2D:
	var p := GPUParticles2D.new()
	p.texture = dot_texture()
	p.amount = amount
	p.lifetime = life
	p.one_shot = one_shot
	p.explosiveness = 1.0 if one_shot else 0.0
	p.fixed_fps = 60
	p.local_coords = false
	p.use_fixed_seed = true
	p.seed = seed_
	p.process_material = pm
	p.emitting = false
	p.visibility_rect = Rect2(-4000, -4000, 8000, 8000)
	add_child(p)
	return p


func fire_material(speed: float, spread: float) -> ParticleProcessMaterial:
	var pm := ParticleProcessMaterial.new()
	pm.particle_flag_disable_z = true
	pm.direction = Vector3(1, 0, 0)
	pm.spread = spread
	pm.initial_velocity_min = speed * 0.85
	pm.initial_velocity_max = speed * 1.15
	pm.gravity = Vector3(0, -260, 0)
	pm.damping_min = 40.0
	pm.damping_max = 120.0
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.35))
	sc.add_point(Vector2(0.5, 1.4))
	sc.add_point(Vector2(1, 2.2))
	var sct := CurveTexture.new()
	sct.curve = sc
	pm.scale_curve = sct
	pm.color_ramp = ramp([0.0, 0.25, 0.6, 1.0], [Color(4.0, 3.4, 1.8, 1), Color(3.2, 1.3, 0.3, 0.95), Color(1.2, 0.25, 0.08, 0.6), Color(0.15, 0.12, 0.12, 0.0)])
	return pm


func build_particles() -> void:
	breath = emitter(700, 0.30, 3, fire_material(1500, 7), false)
	blast = emitter(900, 0.65, 4, fire_material(1700, 6), false)
	var spm := fire_material(700, 75)
	spm.direction = Vector3(-0.2, -1, 0)
	spm.gravity = Vector3(0, -500, 0)
	splash = emitter(300, 0.45, 5, spm, false)
	var smpm := ParticleProcessMaterial.new()
	smpm.particle_flag_disable_z = true
	smpm.direction = Vector3(0, -1, 0)
	smpm.spread = 25
	smpm.initial_velocity_min = 40
	smpm.initial_velocity_max = 90
	smpm.gravity = Vector3(0, -40, 0)
	smpm.scale_min = 1.0
	smpm.scale_max = 2.2
	smpm.color_ramp = ramp([0.0, 1.0], [Color(0.35, 0.3, 0.32, 0.45), Color(0.2, 0.18, 0.2, 0.0)])
	smoke = emitter(80, 1.6, 6, smpm, false)
	# ambient embers drifting up across the battlefield
	var epm := ParticleProcessMaterial.new()
	epm.particle_flag_disable_z = true
	epm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	epm.emission_box_extents = Vector3(2600, 40, 1)
	epm.direction = Vector3(0.2, -1, 0)
	epm.spread = 30
	epm.initial_velocity_min = 30
	epm.initial_velocity_max = 90
	epm.gravity = Vector3(0, -10, 0)
	epm.scale_min = 0.08
	epm.scale_max = 0.18
	epm.color_ramp = ramp([0.0, 0.2, 1.0], [Color(3.0, 1.4, 0.4, 0), Color(3.0, 1.4, 0.4, 1), Color(1.5, 0.4, 0.1, 0)])
	var embers := emitter(140, 7.0, 7, epm, false)
	embers.position = Vector2(0, 40)
	embers.preprocess = 7.0
	embers.emitting = true
	# one-shot bursts per event: sparks for hits, dust for impacts
	for i in EVENTS.size():
		var e: Dictionary = EVENTS[i]
		if e["type"] == "hit":
			var pm := ParticleProcessMaterial.new()
			pm.particle_flag_disable_z = true
			pm.spread = 180
			pm.initial_velocity_min = 300
			pm.initial_velocity_max = 900 + 700 * float(e["power"])
			pm.gravity = Vector3(0, 1600, 0)
			pm.damping_min = 200
			pm.damping_max = 500
			pm.scale_min = 0.08
			pm.scale_max = 0.22
			if e["kind"] == "shield":
				pm.color_ramp = ramp([0.0, 1.0], [Color(3.0, 2.8, 2.2, 1), Color(1.5, 0.8, 0.3, 0)])
			else:
				pm.color_ramp = ramp([0.0, 0.5, 1.0], [Color(4.0, 3.0, 1.2, 1), Color(3.0, 0.8, 0.2, 1), Color(0.6, 0.05, 0.05, 0)])
			var p := emitter(int(60 + 120 * float(e["power"])), 0.6, 20 + i, pm, true)
			p.position = P([e["x"], e["y"]])
			bursts[i] = p
		elif e["type"] == "dust":
			var pm := ParticleProcessMaterial.new()
			pm.particle_flag_disable_z = true
			pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
			pm.emission_box_extents = Vector3(140 * float(e["power"]) + 40, 4, 1)
			pm.direction = Vector3(0, -1, 0)
			pm.spread = 85
			pm.initial_velocity_min = 120
			pm.initial_velocity_max = 520 * float(e["power"]) + 100
			pm.gravity = Vector3(0, 120, 0)
			pm.damping_min = 300
			pm.damping_max = 500
			pm.scale_min = 0.6
			pm.scale_max = 1.6 * float(e["power"]) + 0.6
			pm.color_ramp = ramp([0.0, 1.0], [Color(0.55, 0.40, 0.38, 0.6), Color(0.35, 0.25, 0.25, 0.0)])
			var p := emitter(int(30 + 60 * float(e["power"])), 1.2, 40 + i, pm, true)
			p.position = Vector2(float(e["x"]) * PX, -4)
			bursts[i] = p


# ---------------------------------------------------------------- HUD

func make_label(text: String, size: int, color: Color, outline: int) -> Label:
	var ls := LabelSettings.new()
	ls.font = font
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = Color(0.04, 0.02, 0.05)
	var l := Label.new()
	l.text = text
	l.label_settings = ls
	return l


func bar(parent: Node, pos: Vector2, w: float, h: float, fill: Color) -> Array:
	var frame_r := ColorRect.new()
	frame_r.position = pos - Vector2(5, 5)
	frame_r.size = Vector2(w + 10, h + 10)
	frame_r.color = Color(0.04, 0.02, 0.05, 0.9)
	parent.add_child(frame_r)
	var back := ColorRect.new()
	back.position = pos
	back.size = Vector2(w, h)
	back.color = Color(0.22, 0.06, 0.08)
	parent.add_child(back)
	var chip := ColorRect.new()
	chip.position = pos
	chip.size = Vector2(w, h)
	chip.color = Color(1.0, 0.85, 0.55)
	parent.add_child(chip)
	var f := ColorRect.new()
	f.position = pos
	f.size = Vector2(w, h)
	f.color = fill
	parent.add_child(f)
	var shine := ColorRect.new()
	shine.position = pos + Vector2(0, 3)
	shine.size = Vector2(w, h * 0.3)
	shine.color = Color(1, 1, 1, 0.18)
	parent.add_child(shine)
	return [f, chip]


func build_hud() -> void:
	var hud := CanvasLayer.new()
	hud.layer = 10
	add_child(hud)
	flash = ColorRect.new()
	flash.size = Vector2(1920, 1080)
	flash.color = Color(1, 1, 1, 0)
	hud.add_child(flash)
	var wbar := bar(hud, Vector2(70, 60), BAR_W, 30, Color(0.30, 0.78, 0.45))
	hp_w = wbar[0]
	hp_w_chip = wbar[1]
	var wl := make_label("WARRIOR", 30, Color(1, 1, 1), 8)
	wl.position = Vector2(70, 96)
	hud.add_child(wl)
	boss_box = Control.new()
	hud.add_child(boss_box)
	var dbar := bar(boss_box, Vector2(960 - 600, 990), 1200, 26, Color(0.85, 0.16, 0.14))
	hp_d = dbar[0]
	hp_d_chip = dbar[1]
	var dl := make_label("ASHFANG, THE DRAGON", 30, Color(1.0, 0.85, 0.55), 8)
	dl.position = Vector2(960 - 600, 944)
	boss_box.add_child(dl)
	boss_box.modulate.a = 0.0
	banner = make_label("VICTORY", 180, Color(1.0, 0.82, 0.3), 26)
	banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	banner.size = Vector2(1920, 260)
	banner.position = Vector2(0, 150)
	banner.pivot_offset = Vector2(960, 130)
	banner.modulate.a = 0.0
	hud.add_child(banner)


# ---------------------------------------------------------------- per frame

func ev_window(e: Dictionary, length: float) -> float:
	var t := frame / 60.0
	var t0: float = e["t"]
	return -1.0 if t < t0 or t > t0 + length else (t - t0) / length


func _process(_delta: float) -> void:
	fr = DATA[min(frame, DATA.size() - 1)]
	var t := frame / 60.0
	var c: Array = fr["cam"]
	cam.position = Vector2(c[0] * PX, -c[1] * PX)
	cam.zoom = Vector2.ONE * float(c[2])
	var d: Dictionary = fr["d"]
	var mouth := P(d["mouth"])
	var ang := deg_to_rad(-float(d["fire_dir"]))
	var fire_on: bool = d["fire"] > 0.05 and not fr["frozen"]
	var a: float = fr["a"]
	breath.position = mouth
	breath.rotation = ang
	blast.position = mouth
	blast.rotation = ang
	breath.emitting = fire_on and a < 9.0
	blast.emitting = fire_on and a >= 9.0
	# fire splashing off the shield
	splash.position = P(fr["w"]["hand_b"]) + Vector2(18, 0)
	splash.emitting = fire_on and a < 9.0 and a > 5.85
	smoke.position = mouth
	smoke.emitting = (a > 7.4 and a < 8.6) or (a > 14.05 and a < 15.0)
	for i in bursts:
		if frame == int(round(float(EVENTS[i]["t"]) * 60.0)):
			bursts[i].restart()
			bursts[i].emitting = true
	update_hud(t)
	actors.queue_redraw()
	fx.queue_redraw()
	frame += 1


func update_hud(t: float) -> void:
	var hp: Dictionary = fr["hp"]
	var lag: Dictionary = DATA[max(0, frame - 27)]["hp"]
	set_bar(hp_w, hp_w_chip, 70, BAR_W, hp["warrior"], lag["warrior"])
	set_bar(hp_d, hp_d_chip, 360, 1200, hp["dragon"], lag["dragon"])
	var roar_t := 4.75
	var vic_t := 0.0
	for e in EVENTS:
		if e["type"] == "roar":
			roar_t = e["t"]
		if e["type"] == "victory":
			vic_t = e["t"]
	boss_box.modulate.a = clampf((t - roar_t) / 0.4, 0.0, 1.0) * (1.0 - clampf((t - vic_t + 0.3) / 0.4, 0.0, 1.0))
	if t >= vic_t:
		var u := clampf((t - vic_t) / 0.35, 0.0, 1.0)
		var back := 1.70158
		var s := 1.0 + (back + 1.0) * pow(u - 1.0, 3) + back * pow(u - 1.0, 2)
		banner.scale = Vector2.ONE * maxf(0.01, s)
		banner.modulate = Color(1.5, 1.25, 0.9, 1.0)
	# screen flash for the finishing blow; hdr_2d blends in linear light, so keep alpha small
	var fl := 0.0
	for e in EVENTS:
		if e["type"] == "hit" and float(e["power"]) >= 1.0:
			var u2 := ev_window(e, 0.12)
			if u2 >= 0.0:
				fl = 0.12 * (1.0 - u2) * (1.0 - u2)
	flash.color.a = fl


func set_bar(f: ColorRect, chip: ColorRect, x0: float, w: float, v: float, lag: float) -> void:
	f.size.x = w * v
	chip.size.x = w * maxf(v, lag)


# ---------------------------------------------------------------- drawing

func struck(kinds: Array) -> bool:
	var t := frame / 60.0
	for e in EVENTS:
		if e["type"] == "hit" and kinds.has(e["kind"]) and t >= float(e["t"]) and t < float(e["t"]) + 0.07:
			return true
	return false


func tri(node: CanvasItem, a: Vector2, b: Vector2, c: Vector2, color: Color) -> void:
	# skip degenerate triangles: Godot fails (and logs) when it cannot triangulate them
	if absf((b - a).cross(c - a)) > 0.5:
		node.draw_colored_polygon(PackedVector2Array([a, b, c]), color)


func quad(node: CanvasItem, q: PackedVector2Array, color: Color) -> void:
	# as two triangles, so a twisted quad still draws
	tri(node, q[0], q[1], q[2], color)
	tri(node, q[0], q[2], q[3], color)


func fan(node: CanvasItem, pts: PackedVector2Array, color: Color) -> void:
	for k in range(1, pts.size() - 1):
		tri(node, pts[0], pts[k], pts[k + 1], color)


func band(node: CanvasItem, outline: Array, color: Color, round_joints: bool) -> void:
	# an outline baked as left side + reversed right side: draw it as quads plus joint discs
	var n := outline.size() / 2
	for i in n - 1:
		var q := PackedVector2Array([P(outline[i]), P(outline[i + 1]), P(outline[2 * n - 2 - i]), P(outline[2 * n - 1 - i])])
		quad(node, q, color)
		if round_joints and i > 0:
			var c := (q[0] + q[3]) * 0.5
			node.draw_circle(c, (q[0] - q[3]).length() * 0.5, color)


func line(node: CanvasItem, pts: PackedVector2Array, color: Color, w: float) -> void:
	node.draw_polyline(pts, color, w, true)
	for p in pts:
		node.draw_circle(p, w * 0.5, color)


func draw_actors() -> void:
	var d: Dictionary = fr["d"]
	var hit_d := struck(["slash", "plunge"])
	var hit_w := struck(["shield"])
	var flash_c := Color(1.8, 1.8, 1.8)
	var body_c := flash_c if hit_d else D_BODY
	var dark_c := flash_c if hit_d else D_DARK
	var belly_c := flash_c if hit_d else D_BELLY
	# shadows
	var sh: Array = d["shadow"]
	var sp := PackedVector2Array()
	for k in 32:
		sp.append(Vector2(float(sh[0]) * PX + cos(k / 32.0 * TAU) * float(sh[1]) * PX * 0.5, 6 + sin(k / 32.0 * TAU) * 16))
	actors.draw_colored_polygon(sp, Color(0, 0, 0, 0.35))
	var hipx: float = fr["w"]["hip"][0]
	var hy: float = fr["w"]["hip"][1]
	var ww := maxf(0.2, 0.6 - 0.15 * maxf(0.0, hy - 0.8)) * PX
	sp = PackedVector2Array()
	for k in 24:
		sp.append(Vector2(hipx * PX + cos(k / 24.0 * TAU) * ww * 0.5, 5 + sin(k / 24.0 * TAU) * 10))
	actors.draw_colored_polygon(sp, Color(0, 0, 0, 0.35))
	# dragon: far side first
	draw_wing(d["wings"]["far"], D_WING.darkened(0.35), D_DARK.darkened(0.4))
	for L in d["legs"]:
		if not L["near"]:
			draw_leg(L, dark_c.darkened(0.25))
	band(actors, d["body"], body_c, true)
	band(actors, d["belly"], belly_c, false)
	for s in d["spikes"]:
		var sp3 := PA(s)
		tri(actors, sp3[0], sp3[1], sp3[2], dark_c)
	fan(actors, PA(d["jaw"]), dark_c)
	fan(actors, PA(d["skull"]), body_c)
	for teeth in d["teeth"]:
		actors.draw_polyline(PA(teeth), IVORY, 3.0, true)
	for h in d["horns"]:
		line(actors, PA(h), IVORY, 7.0)
	var eye := P(d["eye"])
	if float(d["eye_open"]) > 0.5:
		actors.draw_circle(eye, 8, Color(3.0, 2.4, 0.4))
		actors.draw_circle(eye + Vector2(-1, 0), 3, Color(0.1, 0.0, 0.0))
	else:
		actors.draw_line(eye + Vector2(-8, 0), eye + Vector2(8, 0), Color(0.15, 0.02, 0.02), 3.0)
	for L in d["legs"]:
		if L["near"]:
			draw_leg(L, body_c)
	draw_wing(d["wings"]["near"], D_WING, dark_c)
	draw_warrior(hit_w)


func draw_wing(wg: Dictionary, mem: Color, bone: Color) -> void:
	fan(actors, PA(wg["mem"]), mem)
	for b in wg["bones"]:
		line(actors, PA(b), bone, 9.0)


func draw_leg(L: Dictionary, color: Color) -> void:
	line(actors, PA(L["pts"]), color, float(L["w"]) * PX)
	for c in L["claws"]:
		actors.draw_line(P(c[0]), P(c[1]), IVORY, 5.0, true)


func draw_warrior(hit: bool) -> void:
	var w: Dictionary = fr["w"]
	var body := Color(1.8, 1.8, 1.8) if hit else BODY
	# cape: a strip along the simulated chain, wide at the shoulders
	var cape: Array = fr["cape"]
	for i in cape.size() - 1:
		var a := P(cape[i])
		var b := P(cape[i + 1])
		var n := (b - a).orthogonal().normalized()
		var wa := lerpf(10.0, 26.0, float(i) / cape.size())
		var wb := lerpf(10.0, 26.0, float(i + 1) / cape.size())
		quad(actors, PackedVector2Array([a + n * wa, b + n * wb, b - n * wb, a - n * wa]), CAPE if i % 2 == 0 else CAPE.darkened(0.08))
	line(actors, PackedVector2Array([P(w["hip"]), P(w["knee_b"]), P(w["foot_b"])]), body.darkened(0.2), 14.0)
	line(actors, PackedVector2Array([P(w["hip"]), P(w["neck"])]), body, 18.0)
	# armour: breastplate and belt
	var hip := P(w["hip"])
	var neck := P(w["neck"])
	var up := (neck - hip).normalized()
	var side := up.orthogonal()
	quad(actors, PackedVector2Array([neck + side * 16 - up * 6, neck - side * 16 - up * 6, hip + up * 40 - side * 13, hip + up * 40 + side * 13]), STEEL_DARK)
	actors.draw_line(hip + up * 12 + side * 14, hip + up * 12 - side * 14, Color(0.35, 0.2, 0.08), 7.0)
	line(actors, PackedVector2Array([P(w["hip"]), P(w["knee_f"]), P(w["foot_f"])]), body, 15.0)
	# head with helmet and plume
	var head := P(w["head"])
	actors.draw_circle(head, 0.17 * PX, Color(0.82, 0.62, 0.48) if not hit else body)
	var dome := PackedVector2Array()
	var hu := Vector2(fr["w_up"][0], -fr["w_up"][1]).normalized()
	var base_ang := hu.angle()
	for k in 17:
		var aa := base_ang - PI * 0.55 + PI * 1.1 * k / 16.0
		dome.append(head + Vector2(cos(aa), sin(aa)) * 0.195 * PX)
	dome.append(head + hu.rotated(-PI * 0.55) * 0.195 * PX * 0.2)
	fan(actors, dome, STEEL if not hit else body)
	actors.draw_line(head + hu * 0.19 * PX, head - hu * 0.05 * PX, STEEL_DARK, 6.0)
	var plume: Array = fr["plume"]
	line(actors, PA(plume), Color(0.9, 0.12, 0.14), 9.0)
	# back arm and shield
	line(actors, PackedVector2Array([P(w["neck"]), P(w["elbow_b"]), P(w["hand_b"])]), body.darkened(0.15), 12.0)
	var sc := P(w["hand_b"])
	actors.draw_circle(sc, 0.27 * PX, Color(0.75, 0.70, 0.62) if not hit else body)
	actors.draw_circle(sc, 0.235 * PX, WOOD)
	actors.draw_arc(sc, 0.16 * PX, 0, TAU, 32, WOOD.darkened(0.25), 4.0, true)
	actors.draw_circle(sc, 0.06 * PX, Color(0.8, 0.75, 0.65))
	# front arm and sword
	line(actors, PackedVector2Array([P(w["neck"]), P(w["elbow_f"]), P(w["hand_f"])]), body, 12.0)
	var glint := 1.0
	if int(fr["sword_trail"]) == 1:
		glint = 1.8
	actors.draw_line(P(w["hand_f"]), P(w["tip"]), Color(0.86, 0.9, 1.0) * glint, 9.0, true)
	actors.draw_line(P(w["hand_f"]), P(w["tip"]), Color(1.2, 1.25, 1.4) * glint, 3.0, true)
	actors.draw_line(P(w["guard_a"]), P(w["guard_b"]), GOLD, 7.0, true)
	actors.draw_line(P(w["pommel"]), P(w["hand_f"]), Color(0.35, 0.2, 0.1), 7.0, true)
	actors.draw_circle(P(w["pommel"]), 6, GOLD)


func draw_fx() -> void:
	var t := frame / 60.0
	# sword trail: the blade's sweep over the last frames
	if int(fr["sword_trail"]) == 1:
		for k in range(1, 9):
			var f0: Dictionary = DATA[max(0, frame - k)]
			var f1: Dictionary = DATA[max(0, frame - k + 1)]
			var h1: Vector2 = P(f1["w"]["hand_f"]).lerp(P(f1["w"]["tip"]), 0.55)
			var h0: Vector2 = P(f0["w"]["hand_f"]).lerp(P(f0["w"]["tip"]), 0.55)
			quad(fx, PackedVector2Array([h1, P(f1["w"]["tip"]), P(f0["w"]["tip"]), h0]), Color(1.1, 1.25, 1.6, 0.3 * (1.0 - k / 9.0)))
	# claw trail
	if float(fr["d"]["claw"]) > 0.5:
		for k in range(1, 7):
			var a: Array = DATA[max(0, frame - k)]["d"]["claw_tip"]
			var b: Array = DATA[max(0, frame - k + 1)]["d"]["claw_tip"]
			fx.draw_line(P(a), P(b), Color(2.0, 1.2, 1.0, 0.6 * (1.0 - k / 7.0)), 26.0 * (1.0 - k / 7.0), true)
	for e in EVENTS:
		if e["type"] == "hit":
			var u := ev_window(e, 0.32)
			if u >= 0.0:
				var c := P([e["x"], e["y"]])
				var p: float = e["power"]
				fx.draw_circle(c, 70.0 * p * (1.0 - u), Color(3.5, 2.8, 1.6, 1.0 - u))
				fx.draw_arc(c, 50.0 + 330.0 * p * (1.0 - pow(1.0 - u, 3)), 0, TAU, 64, Color(2.6, 2.2, 1.8, 1.0 - u), 10.0 * (1.0 - u) + 1.0, true)
			var un := ev_window(e, 0.8)
			if un >= 0.0:
				var dmg := "BLOCK" if e["kind"] == "shield" else "-%d" % int(round(35.0 * float(e["power"]) + 5.0))
				var col := Color(1.0, 0.9, 0.7) if e["kind"] == "shield" else Color(1.8, 1.4, 0.4)
				col.a = 1.0 - un * un
				var pos := P([e["x"], e["y"]]) + Vector2(30, -60 - 90 * un)
				fx.draw_string_outline(font, pos, dmg, HORIZONTAL_ALIGNMENT_LEFT, -1, 54, 10, Color(0.05, 0.02, 0.04, col.a))
				fx.draw_string(font, pos, dmg, HORIZONTAL_ALIGNMENT_LEFT, -1, 54, col)
		elif e["type"] == "roar":
			for r in 3:
				var u := ev_window(e, 0.9)
				var ur := u - r * 0.18
				if u >= 0.0 and ur >= 0.0:
					var c: Vector2 = P(DATA[frame]["d"]["mouth"])
					fx.draw_arc(c, 60.0 + 900.0 * ur, 0, TAU, 96, Color(1.4, 1.0, 0.8, 0.5 * (1.0 - ur)), 12.0 * (1.0 - ur) + 2.0, true)
	# a warm glow at the mouth while breathing fire
	var d: Dictionary = fr["d"]
	if float(d["fire"]) > 0.05:
		fx.draw_circle(P(d["mouth"]), 40.0, Color(3.0, 1.6, 0.5, 0.5 * float(d["fire"])))
