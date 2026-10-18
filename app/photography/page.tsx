import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ControlMap } from './demos/control-map'
import { ExposureLab } from './demos/exposure-lab'
import { ApertureDemo } from './demos/aperture'
import { ShutterDemo } from './demos/shutter'
import { IsoDemo } from './demos/iso'
import { ExposureCompDemo } from './demos/exposure-comp'
import { HistogramDemo } from './demos/histogram'
import { FocusDemo } from './demos/focus'
import { WhiteBalanceDemo } from './demos/white-balance'
import { NightModeDemo } from './demos/night-mode'
import { FlashDemo } from './demos/flash'
import { DepthDemo } from './demos/depth'
import { StylesDemo } from './demos/styles'
import { LiveDemo } from './demos/live'
import { MegapixelDemo, RawDemo } from './demos/format'
import { AspectDemo } from './demos/aspect'
import { TimerDemo } from './demos/timer'
import { ZoomDemo } from './demos/zoom'
import { CompositionDemo } from './demos/composition'
import { Missions, Quiz, Recipes } from './demos/practice'
import { HowAPhotoIsMade, LightDirections, Triangle } from './figures'
import { Note } from './ui'

export const metadata: Metadata = {
  title: 'Photography',
  description: 'Photography from zero on an iPhone 18 Pro: every Camera setting explained, with a simulator to try each one.',
}

const CONTENTS: { group: string; items: [string, string][] }[] = [
  { group: 'Start', items: [['controls', 'Your camera, decoded'], ['how', 'How a photo is made'], ['triangle', 'The exposure triangle']] },
  { group: 'The big three', items: [['aperture', 'Lens aperture'], ['shutter-speed', 'Shutter speed'], ['iso', 'ISO']] },
  {
    group: 'Getting it right',
    items: [['exposure', 'Exposure'], ['histogram', 'Histogram'], ['focus', 'Focus'], ['white-balance', 'White balance']],
  },
  {
    group: 'Camera features',
    items: [
      ['night-mode', 'Night mode'],
      ['flash', 'Flash'],
      ['depth', 'Depth and Portrait'],
      ['styles', 'Styles'],
      ['live', 'Live Photos'],
      ['format', 'Format'],
      ['aspect', 'Aspect'],
      ['timer', 'Timer'],
    ],
  },
  { group: 'Seeing', items: [['zoom', 'Lenses and zoom'], ['composition', 'Composition'], ['light', 'Light']] },
  {
    group: 'Practice',
    items: [['recipes', 'Recipes'], ['quiz', 'Fix the photo'], ['missions', 'Missions'], ['settings', 'Settings worth changing'], ['words', 'Words']],
  },
]

function Section({ id, kicker, title, children }: { id: string; kicker?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 pt-14">
      {kicker && <div className="mb-1 text-xs font-medium tracking-wider text-orange-600 uppercase">{kicker}</div>}
      <h2 className="mb-4 text-xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:underline hover:decoration-orange-600 hover:underline-offset-4">
          {title}
        </a>
      </h2>
      {children}
      <a href="#controls" className="mt-6 inline-block text-xs text-neutral-500 hover:text-orange-600">
        ↑ Back to the controls
      </a>
    </section>
  )
}

const P = ({ children }: { children: ReactNode }) => <p className="my-4 text-neutral-800 dark:text-neutral-200">{children}</p>
const List = ({ children }: { children: ReactNode }) => (
  <ul className="my-4 list-disc space-y-1.5 pl-5 text-neutral-800 marker:text-orange-600 dark:text-neutral-200">{children}</ul>
)

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-left text-sm" style={{ display: 'table', whiteSpace: 'normal', maxWidth: 'none' }}>
        <thead className="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 align-top ${j === 0 ? 'font-mono text-xs whitespace-nowrap text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Page() {
  return (
    <article className="pb-24">
      <h1 className="title mb-3 text-2xl font-semibold tracking-tighter">Photography, from zero</h1>
      <p className="mb-4 text-neutral-600 dark:text-neutral-400">
        A hands-on course for the iPhone 18 Pro. Every button in the Camera app, what it does to a picture, and when to
        reach for it, with a little camera simulator so you can try each one right here.
      </p>
      <P>
        You don’t need to learn all of this before you take good photos. The iPhone gets most pictures right on
        its own. What this page gives you is the <em>why</em>, so that when a photo comes out wrong (blurry, grey,
        orange, grainy) you know which control fixes it.
      </P>
      <P>
        Read it top to bottom once. The first half (light, aperture, shutter, ISO) is the part every other setting is
        built on. After that, dip in wherever you like.
      </P>
      <Note>
        The “photos” in the demos are drawings, but the camera they go through is simulated properly: light
        adds up in stops, blur grows with distance from the focus, grain grows with ISO, and highlights clip. What you
        see happen here happens on your phone too.
      </Note>

      <nav aria-label="Contents" className="my-8 grid gap-x-6 gap-y-4 rounded-xl border border-neutral-200 p-4 text-sm sm:grid-cols-3 dark:border-neutral-800">
        {CONTENTS.map((g) => (
          <div key={g.group}>
            <div className="mb-1 text-xs font-medium tracking-wider text-neutral-500 uppercase">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map(([id, name]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-neutral-700 hover:text-orange-600 dark:text-neutral-300">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Section id="controls" kicker="Start here" title="Your camera, decoded">
        <P>
          In the Camera app, tap the button with six dots in the corner and this panel slides up. Each button is one
          idea in photography. Tap one here to jump to its lesson.
        </P>
        <ControlMap />
        <P>
          The <b>Edit</b> button in the top-left corner picks which controls sit in the row across the top of the
          screen. Yours has Flash, Live and Night mode there now. Once you know what you use most, put those there.
        </P>
        <P>
          Lens Aperture, Shutter Speed, White Balance and the Histogram are the iPhone 18 Pro’s new{' '}
          <em>manual</em> controls. Leave them on auto and the phone decides for you. Set one and you take that
          decision over, and the phone works around your choice.
        </P>
      </Section>

      <Section id="how" kicker="Lesson 1" title="How a photo is made">
        <P>
          A camera is a dark box that catches light. Everything in a photo is light that bounced off something,
          travelled through the lens, and landed on the sensor.
        </P>
        <HowAPhotoIsMade />
        <List>
          <li>
            <b>The lens</b> bends the light so each point of the scene lands as a point on the sensor. When it lands as
            a point, that part of the picture is <em>in focus</em>; when it lands as a blob, it’s blurry.
          </li>
          <li>
            <b>The aperture</b> is the hole the light comes through. A bigger hole lets in more light at once.
          </li>
          <li>
            <b>The shutter</b> decides how long the sensor collects light: a thousandth of a second, or thirty seconds.
          </li>
          <li>
            <b>The sensor</b> is a grid of 48 million tiny light buckets (that’s the “48MP”). Each one
            counts how much light fell into it. More light, brighter pixel.
          </li>
          <li>
            <b>Processing</b> turns those counts into a picture: colour, contrast, cleaning up grain, and merging
            several frames into one (Apple calls this Smart HDR and the Photonic Engine).
          </li>
        </List>
        <P>
          The single most important word in photography is <b>exposure</b>: how much light the sensor collected.
          Too little and the picture is dark and grainy. Too much and the bright parts turn to flat white with no
          detail. Three settings control it, and that’s the next lesson.
        </P>
      </Section>

      <Section id="triangle" kicker="Lesson 2" title="The exposure triangle">
        <P>
          There are three ways to make a picture brighter: open the hole wider (<b>aperture</b>), keep it open longer
          (<b>shutter speed</b>), or amplify what you caught (<b>ISO</b>). They all change brightness, but each one
          also changes something else about the picture. That side effect is why you’d pick one over another.
        </P>
        <Triangle />
        <P>
          Photographers count light in <b>stops</b>. One stop is double the light, or half. Every setting moves in
          stops, so you can trade them against each other:
        </P>
        <Table
          head={['One stop brighter', 'Is the same as']}
          rows={[
            ['1/500 → 1/250 s', 'Keeping the shutter open twice as long'],
            ['ISO 100 → 200', 'Amplifying the signal twice as much'],
            ['ƒ/2.8 → ƒ/2', 'An opening with twice the area (ƒ-numbers go up by about 1.4× per stop)'],
          ]}
        />
        <P>
          So ƒ/1.8, 1/500 s, ISO 100 gives the same brightness as ƒ/1.8, 1/250 s, ISO 50. Same brightness, but the
          second picture has twice the motion blur and a little less grain. Every photo is a choice like that.
        </P>
        <Note kind="phone">
          In the Camera app you can set Lens Aperture and Shutter Speed, but ISO is always automatic. Fix either
          one and the iPhone moves ISO (and whatever else you left on auto) to keep the brightness right. Big cameras
          call these “aperture priority” and “shutter priority”. If you ever want to set ISO
          by hand too, third-party camera apps such as Halide can.
        </Note>
        <div id="lab" className="scroll-mt-6" />
        <ExposureLab />
        <P>
          Things to try: in the <b>Park</b>, drag the shutter to 1/15 and watch the cyclist smear (and the picture
          blow out). On the <b>Night street</b>, switch to full manual and see how dark the honest exposure is
          without help. In the <b>Café</b>, tap the back wall to focus there.
        </P>
      </Section>

      <Section id="aperture" kicker="The big three" title="Lens aperture">
        <P>
          The aperture is the opening inside the lens. It’s written as an <b>ƒ-number</b>, like ƒ/1.8, and the
          number works backwards: it’s the lens’s focal length divided by the width of the hole. A{' '}
          <em>small</em> number means a <em>big</em> hole.
        </P>
        <P>
          Your iPhone 18 Pro is the first iPhone whose main camera has a real, moving aperture: six thin blades that
          close to four positions, <b>ƒ/1.48</b>, <b>ƒ/1.8</b> (the default), <b>ƒ/2.8</b> and <b>ƒ/4</b>. It only
          applies to the main camera, so 1× and 2×. The Ultra Wide and Telephoto have fixed apertures.
        </P>
        <ApertureDemo />
        <P>Aperture does two things:</P>
        <List>
          <li>
            <b>Light.</b> ƒ/1.48 lets in about 7× as much light as ƒ/4. In the dark that means a faster shutter and
            lower ISO: sharper and cleaner.
          </li>
          <li>
            <b>Depth of field</b>: how much in front of and behind the focus also looks sharp. Wide open (ƒ/1.48),
            only a thin slice is sharp and the rest melts into soft blur, which photographers call <em>bokeh</em>.
            Closed down (ƒ/4), more of the scene is sharp at once.
          </li>
        </List>
        <P>
          The honest catch: a phone’s lens and sensor are tiny, so most of the time almost everything is sharp
          whatever the aperture. You’ll see the difference mostly <b>up close</b>, within about half a metre:
          food, flowers, a coffee cup. For portraits a few metres away, the blur comes from Portrait mode, not the
          aperture.
        </P>
        <Table
          head={['Setting', 'Use it for']}
          rows={[
            ['ƒ/1.48', 'Low light; close-ups where you want the background melted away'],
            ['ƒ/1.8', 'Everyday shooting. The default for a reason'],
            ['ƒ/2.8', 'Close-ups that need more depth (a whole plate of food); groups at different distances'],
            ['ƒ/4', 'Landscapes, documents, light trails on a tripod; turns street lights into little stars'],
          ]}
        />
        <Note kind="phone">
          Tap <b>Lens Aperture</b> in the controls and tap a value. Leave it on Auto and the iPhone chooses for
          you. It works on the main camera, the 1× and 2× buttons.
        </Note>
      </Section>

      <Section id="shutter-speed" kicker="The big three" title="Shutter speed">
        <P>
          Shutter speed is how long the sensor collects light, written in seconds: 1/1000 is a thousandth of a second;
          2s is two whole seconds. Double the time, one stop more light.
        </P>
        <P>
          Its side effect is <b>motion</b>. Anything that moves while the shutter is open smears across the picture.
          That can be a mistake (a blurry child) or the whole point (silky water, streaks of headlights). It also
          includes <em>your</em> movement: hold the phone for a long exposure and your hands blur everything.
        </P>
        <ShutterDemo />
        <Table
          head={['Speed', 'What it does']}
          rows={[
            ['1/4000', 'Freezes splashing water, a hummingbird, a tennis serve'],
            ['1/1000', 'Running kids and dogs, cyclists, sport'],
            ['1/250', 'People walking, someone talking with their hands'],
            ['1/60', 'Still subjects, handheld. Slower than this, hold your breath'],
            ['1/8 – 1s', 'Silky water, moving crowds turned to ghosts. Tripod'],
            ['2 – 30s', 'Light trails, night skies, Night mode on a tripod'],
          ]}
        />
        <Note>
          Long exposures in daylight let in far too much light, even at the lowest ISO. Photographers put a dark{' '}
          <b>ND filter</b> on the lens. On an iPhone the easier trick is a Live Photo with the Long Exposure effect,
          covered further down.
        </Note>
        <Note kind="phone">
          Tap <b>Shutter Speed</b> and drag the slider. The iPhone adjusts ISO to keep the brightness right. When it
          runs out of ISO, the picture gets brighter or darker instead. The phone’s stabiliser lets you hold
          slower than 1/60 for still things, but not much slower than 1/15.
        </Note>
      </Section>

      <Section id="iso" kicker="The big three" title="ISO">
        <P>
          ISO is amplification. The sensor catches some light, and ISO turns up the volume on the signal: ISO 200 is
          twice as bright as ISO 100. The lowest setting, around ISO 50 on the main camera, is the cleanest.
        </P>
        <P>
          Like turning up a quiet recording, you get the hiss too. Raising ISO doesn’t add light; it amplifies
          what little you caught, along with the random noise in it. That noise shows up as speckled grain, worst in
          the shadows. Phones then smooth the grain away, which leaves dim photos looking smudgy, like a watercolour.
        </P>
        <IsoDemo />
        <P>
          The lesson: <b>light beats ISO</b>. Before you accept a grainy picture, find more light (move to the
          window, turn on a lamp), use a wider aperture, or hold the phone still for a longer exposure (which is what
          Night mode does for you).
        </P>
        <Note kind="phone">
          There’s no ISO control in the Camera app; it’s always automatic. You steer it indirectly: a
          faster shutter or a smaller aperture pushes ISO up, Night mode and a wide aperture bring it down.
        </Note>
      </Section>

      <Section id="exposure" kicker="Getting it right" title="Exposure (the ± control)">
        <P>
          The iPhone measures the light and picks settings to make the scene come out at an average brightness. It
          aims for <em>middle grey</em>. Most of the time that’s right. But if the scene is mostly white (snow, a
          beach, a white wall) the camera thinks it’s too bright and darkens it to grey. If it’s mostly dark
          (night, a stage), it brightens it too much.
        </P>
        <P>
          <b>Exposure</b> (exposure compensation) is how you say “brighter than that” or “darker
          than that”. It goes from −2 to +2 stops in thirds. The camera still chooses the settings; you move
          its target.
        </P>
        <ExposureCompDemo />
        <List>
          <li>
            <b>Quick way:</b> tap the screen to focus, and a sun icon appears beside the yellow square. Drag up for
            brighter, down for darker.
          </li>
          <li>
            <b>Lock it:</b> touch and hold on the screen until <em>AE/AF Lock</em> appears. Focus and exposure stay
            put while you reframe. Great for a series of photos that should match.
          </li>
          <li>
            <b>The Exposure control</b> in the panel sets it for every photo until you set it back to 0. To have
            it remembered even after you close the app, turn on Settings › Camera › Preserve Settings › Exposure
            Adjustment.
          </li>
        </List>
        <Note>
          When in doubt, err slightly dark. You can lift a dark photo in editing (with some grain). A part that came
          out pure white has no detail left at all.
        </Note>
      </Section>

      <Section id="histogram" kicker="Getting it right" title="Histogram">
        <P>
          A screen can lie: your phone’s brightness, the sun on the glass, the room you’re in. A histogram
          doesn’t. It’s a bar chart of every pixel in the picture, sorted by brightness: black on the left,
          white on the right, and the height says how many pixels have that brightness.
        </P>
        <HistogramDemo />
        <List>
          <li>
            <b>Piled against the right wall</b>: highlights are <em>clipped</em>, pure white, detail gone. Turn
            exposure down.
          </li>
          <li>
            <b>Piled against the left wall</b>: shadows crushed to black. Turn it up, if you want detail there.
          </li>
          <li>
            <b>There’s no “correct” shape.</b> A snowy scene should lean right and a night scene left.
            What matters is that the things you care about aren’t pushed off the edge.
          </li>
        </List>
        <Note kind="phone">
          Turn on <b>Histogram</b> in the controls and a small live graph sits in the viewfinder while you shoot.
          Glance at it when the scene has a bright sky or a dark subject.
        </Note>
      </Section>

      <Section id="focus" kicker="Getting it right" title="Focus">
        <P>
          The lens can make only one distance perfectly sharp at a time. Autofocus picks it for you, usually a face,
          or whatever is nearest the middle. It mostly gets it right, but not always: through a window, behind a
          fence, or with a small subject against a busy background.
        </P>
        <FocusDemo />
        <List>
          <li>
            <b>Tap to focus</b> on what matters. The yellow square shows where.
          </li>
          <li>
            <b>Touch and hold</b> for AE/AF Lock, so focus stays put when you reframe or the subject moves.
          </li>
          <li>
            <b>The Focus control</b> lets you set focus yourself and keep it there. Use it when autofocus keeps
            hunting: in the dark, through glass, or in video where you don’t want it jumping. If sharp edges
            light up in colour as you adjust, that’s <em>focus peaking</em> showing you what’s sharp.
          </li>
          <li>
            <b>Too close?</b> The main camera can’t focus nearer than about 15–20 cm. Go closer and the iPhone
            switches to the Ultra Wide for <b>Macro</b> (a little flower icon appears). Turn on Settings › Camera ›
            Macro Control if you’d rather decide yourself.
          </li>
        </List>
      </Section>

      <Section id="white-balance" kicker="Getting it right" title="White balance">
        <P>
          Light has a colour, though your eyes hide it from you. A candle is deep orange, a light bulb is warm
          yellow, midday sun is close to white, and the light in open shade on a clear day is blue. Photographers
          measure it as a <b>colour temperature</b> in kelvin (K): low numbers are warm, high numbers are cool.
        </P>
        <Table
          head={['Light', 'About']}
          rows={[
            ['Candle', '1900K'],
            ['Old light bulb', '2700K'],
            ['Warm LED', '3000–3200K'],
            ['Office light', '4000K'],
            ['Midday sun', '5500K'],
            ['Overcast sky', '6500K'],
            ['Open shade', '7500K and up'],
          ]}
        />
        <P>
          White balance tells the camera what colour the light is so it can cancel it out, and a white shirt comes
          out white. The confusing part: you set the number of the <em>light</em>, so setting a low number cools the
          picture down (to cancel orange light), and a high number warms it up.
        </P>
        <WhiteBalanceDemo />
        <List>
          <li>Auto works almost all the time. Start there.</li>
          <li>
            Set it yourself when auto “fixes” something you wanted (a sunset going grey), when the light
            is mixed (a lamp plus a window), or when a series should match exactly.
          </li>
          <li>
            White balance <em>corrects</em> the light. Styles (below) are for <em>adding</em> a look. Get the first
            right before playing with the second.
          </li>
        </List>
      </Section>

      <Section id="night-mode" kicker="Camera features" title="Night mode">
        <P>
          In dim light the moon icon turns yellow and shows a number: that’s how many seconds Night mode will
          take. Instead of one dark, grainy frame it shoots a burst over those seconds, lines the frames up (so
          your hands don’t blur them) and merges them. It collects as much light as a long exposure, without the
          shake.
        </P>
        <NightModeDemo />
        <List>
          <li>Hold still until the counter finishes. Ask people to hold still too: they’ll go soft otherwise.</li>
          <li>
            Tap the moon to change the time: Off, Auto, or up to Max. Rest the phone on a wall, a table or a tripod and
            the iPhone notices and offers up to 30 seconds.
          </li>
          <li>
            Turn it off when you want the night to look like night, or when things move (dancing, traffic you want
            sharp).
          </li>
        </List>
      </Section>

      <Section id="flash" kicker="Camera features" title="Flash">
        <P>
          The flash is a small, bright LED next to the lenses. It has three settings: Auto, On and Off. It’s
          useful far less often than people think, because a small light right next to the lens fades fast and
          lights things flat from the front.
        </P>
        <FlashDemo />
        <List>
          <li>
            <b>Bad for:</b> concerts, landscapes, anything further than about 3 m, shooting through windows, food,
            and most indoor portraits (red eyes, shiny faces, black backgrounds).
          </li>
          <li>
            <b>Good for:</b> a face in shadow against a bright sky in daytime (“fill flash”), and the
            occasional dark close-up where nothing can stay still for Night mode.
          </li>
          <li>
            <b>Better light:</b> ask a friend to hold their phone’s torch off to one side. Light from the side
            gives faces shape.
          </li>
        </List>
        <Note>Set Flash to Off and turn it on when you need it. Auto fires in a lot of places it shouldn’t.</Note>
      </Section>

      <Section id="depth" kicker="Camera features" title="Depth and Portrait">
        <P>
          The ƒ button with a line through it is <b>Depth</b>. When the iPhone sees a person, a dog or a cat in an
          ordinary photo, it quietly saves a depth map too: a measure of how far away every part of the scene is.
          With that saved, you can turn the photo into a Portrait afterwards. Tap the ƒ to switch it on or off
          yourself.
        </P>
        <P>
          <b>Portrait mode</b> uses the same depth map to blur the background the way a big camera with a big lens
          would. Its <b>Depth Control</b> goes from ƒ/1.4 (lots of blur) to ƒ/16 (almost none). This ƒ-number is a
          simulation, not the real aperture: it’s software painting the blur in.
        </P>
        <DepthDemo />
        <List>
          <li>Open a Portrait in Photos, tap Edit, and you can change the blur and even what’s in focus.</li>
          <li>
            Portrait Lighting (Natural, Studio, Contour, Stage, Stage Mono, High-Key Mono) relights the face. Studio
            is the most useful; the Stage ones cut the person out onto black.
          </li>
          <li>Watch hair, glasses and raised arms: that’s where the software sometimes guesses wrong.</li>
          <li>Leave around 1 to 2.5 metres between you and your subject, and plenty between them and the background.</li>
        </List>
        <Note>
          <b>Lens Aperture vs Depth:</b> Lens Aperture changes the real opening, so it changes light and real
          blur (which is small on a phone, except up close). Depth is software blur, as strong as you like, but
          only for people, pets and Portrait mode.
        </Note>
      </Section>

      <Section id="styles" kicker="Camera features" title="Photographic Styles">
        <P>
          Styles are the look of your photos: warm or cool, punchy or soft. Unlike a filter slapped on top, the
          iPhone applies them while it processes the photo, and handles skin tones separately so faces stay natural.
        </P>
        <StylesDemo />
        <List>
          <li>
            <b>Undertones</b> (Amber, Gold, Rose Gold, Neutral, Cool Rose) mostly shift skin tones and overall
            warmth.
          </li>
          <li>
            <b>Moods</b> (Vibrant, Natural, Luminous, Dramatic, Quiet, Cozy, Ethereal, and two black-and-whites) are
            stronger looks.
          </li>
          <li>The pad sets <b>Tone</b> (up and down) and <b>Color</b> (left and right); the slider under it is <b>Palette</b>, how strong the style is.</li>
          <li>
            The style isn’t burnt in. In Photos, tap Edit and change it or remove it any time. Pick one you love
            and stick with it: your photos will look like they belong together.
          </li>
        </List>
      </Section>

      <Section id="live" kicker="Camera features" title="Live Photos">
        <P>
          With Live on, the iPhone records about 1.5 seconds before and after you press the shutter, with sound,
          and saves it with the photo. Press and hold the photo in Photos to see it move.
        </P>
        <LiveDemo />
        <List>
          <li>
            <b>Key photo:</b> the still frame people see. Missed the moment by a fraction? Edit the Live Photo and pick
            a better frame.
          </li>
          <li>
            <b>Effects</b> (tap the Live label at the top of the photo): Loop, Bounce, and <b>Long Exposure</b>, the
            best trick in the app. It blends all the frames into one, giving silky water and light trails without a
            tripod or filter. Hold the phone as still as you can for the three seconds.
          </li>
          <li>Live Photos take up more storage. Turn Live off when you don’t need it.</li>
        </List>
      </Section>

      <Section id="format" kicker="Camera features" title="Format">
        <P>
          Your button says <b>HEIF 24</b>: HEIF files at 24 megapixels, the iPhone’s default, and a good one.
          Two choices hide in it: the file type and the resolution.
        </P>
        <P>
          <b>Resolution</b> is how many pixels the photo has. The main sensor has 48 million, but in all but bright
          light, combining them in fours into 12 million bigger “pixels” gives a cleaner result. 24 MP
          is Apple’s blend of the two.
        </P>
        <MegapixelDemo />
        <P>
          <b>File type</b> is how the picture is saved. <b>HEIF</b> (High Efficiency) is a modern format that looks
          like a JPEG at half the size. JPEG is the old universal one; you get it by choosing Most Compatible in
          Settings › Camera › Formats. <b>ProRAW</b> keeps far more of what the sensor saw: more steps of brightness,
          and some detail past white. It’s for editing afterwards.
        </P>
        <RawDemo />
        <Table
          head={['Format', 'Roughly per photo', 'Use it for']}
          rows={[
            ['HEIF 12 MP', '1.5–3 MB', 'Saving space; very low light'],
            ['HEIF 24 MP', '3–5 MB', 'Everyday. Leave it here'],
            ['HEIF 48 MP', '5–10 MB', 'Landscapes and anything you might crop'],
            ['ProRAW 12 MP', '~25 MB', 'Editing; tricky light'],
            ['ProRAW 48 MP', '~75 MB', 'Serious editing, big prints'],
          ]}
        />
        <Note kind="phone">
          If ProRAW or 48 MP don’t show up, turn on Settings › Camera › Formats › ProRAW{' & '}Resolution
          Control. A ProRAW photo looks flatter than a HEIF one straight out of the camera. That’s normal: it
          expects you to edit it.
        </Note>
      </Section>

      <Section id="aspect" kicker="Camera features" title="Aspect">
        <P>
          Aspect ratio is the shape of the picture. The sensor is <b>4:3</b>, so that’s the shape that uses all
          of it. <b>16:9</b> is wide like a TV, and <b>1:1</b> is a square. Both are crops of the 4:3 frame.
        </P>
        <AspectDemo />
        <P>
          Shoot 4:3 unless you know where the photo is going. You can always crop to any shape in Photos later, but
          you can’t add back what you cut off.
        </P>
      </Section>

      <Section id="timer" kicker="Camera features" title="Timer">
        <P>
          The timer waits a few seconds (3 or 10) after you tap before it takes the photo. Two reasons to use it: to
          get yourself into a group photo, and to stop your own tap from shaking the phone on a long exposure.
        </P>
        <TimerDemo />
        <P>
          For a group photo, prop the phone against something steady, set 10 seconds, and walk into the shot. Turn
          Live on too, and you can pick the frame where nobody blinked.
        </P>
      </Section>

      <Section id="zoom" kicker="Seeing" title="Lenses and zoom">
        <P>
          Your iPhone has three cameras on the back, and the buttons above the shutter switch between them. The number
          in mm is the <b>focal length</b>: how wide or narrow the view is, given the way photographers have always
          measured it. Small numbers see more of the scene; big numbers reach in.
        </P>
        <Table
          head={['Button', 'Lens', 'Good for']}
          rows={[
            ['.5×  13 mm', 'Ultra Wide', 'Rooms, big landscapes, dramatic near-and-far, macro close-ups'],
            ['1×  24 mm', 'Main (the best camera)', 'Everything, and anything in low light'],
            ['2×  48 mm', 'Main, cropped', 'Portraits, food, street, the way your eyes see'],
            ['4×  100 mm', 'Telephoto', 'Faces with flattering proportions, details, compressed views'],
            ['8×  200 mm', 'Telephoto, cropped', 'Far-away details. Hold very still'],
          ]}
        />
        <ZoomDemo />
        <List>
          <li>
            Past 8× is <b>digital zoom</b>: the phone just enlarges pixels. Stop at 8×; you can crop later with the
            same result.
          </li>
          <li>
            A wide lens close to a face stretches it (big nose, small ears). For portraits, step back and use 2× or
            4×.
          </li>
          <li>
            Perspective comes from <em>where you stand</em>. The lens only decides how much you crop.
          </li>
        </List>
      </Section>

      <Section id="composition" kicker="Seeing" title="Composition">
        <P>
          Composition is where you put things in the frame. Settings make a photo correct; composition makes it
          interesting. A few old rules get you a long way:
        </P>
        <CompositionDemo />
        <List>
          <li>
            <b>Rule of thirds:</b> imagine the frame cut into three by three. Put the subject on one of the lines or
            crossings, and the horizon on the top or bottom line. Turn on Settings › Camera › Grid to see them.
          </li>
          <li>
            <b>Keep it level:</b> Settings › Camera › Level shows a line that turns yellow when you’re straight.
          </li>
          <li>
            <b>Simplify:</b> step closer, or move so there’s nothing distracting behind the subject. Most bad
            photos have too much in them.
          </li>
          <li>
            <b>Lines:</b> roads, rivers and fences that run into the picture lead the eye to the subject.
          </li>
          <li>
            <b>Frames:</b> shoot through a doorway, an arch or branches to put a frame around the subject.
          </li>
          <li>
            <b>Change height:</b> get down to a child’s or a dog’s eye level. Most photos are taken from
            standing height, so anything else looks fresh.
          </li>
          <li>
            <b>Leave space</b> in front of a face, or in the direction something is moving.
          </li>
        </List>
      </Section>

      <Section id="light" kicker="Seeing" title="Light">
        <P>
          Settings decide whether a photo works; light decides whether it’s beautiful. Before you change a single
          setting, look at where the light is coming from and what colour it is.
        </P>
        <LightDirections />
        <List>
          <li>
            <b>Golden hour</b>, the hour after sunrise and before sunset: warm, low, soft light and long shadows.
            Everything looks better.
          </li>
          <li>
            <b>Blue hour</b>, just after sunset: a deep blue sky that balances with city lights.
          </li>
          <li>
            <b>Midday sun</b> is harsh: dark eye sockets and squinting. Move people into open shade.
          </li>
          <li>
            <b>Overcast</b> is a giant softbox: perfect for portraits and flowers.
          </li>
          <li>
            <b>A window</b> is the best indoor light there is. Put people side-on to it.
          </li>
        </List>
      </Section>

      <Section id="recipes" kicker="Practice" title="Recipes">
        <P>Starting points for common situations. Some load straight into the lab above so you can see them work.</P>
        <Recipes />
      </Section>

      <Section id="quiz" kicker="Practice" title="Fix the photo">
        <P>Each photo below went wrong in one way. Work out which control would have saved it.</P>
        <Quiz />
      </Section>

      <Section id="missions" kicker="Practice" title="Missions">
        <P>
          Reading is the easy part. These are small exercises to do with your phone, one a day or so. Each one is
          about seeing a single setting change a real photo.
        </P>
        <Missions />
      </Section>

      <Section id="settings" kicker="Practice" title="Settings worth changing">
        <P>A few switches in the Settings app, under Camera, worth flipping once:</P>
        <Table
          head={['Setting', 'Why']}
          rows={[
            ['Grid', 'Shows the rule-of-thirds lines'],
            ['Level', 'Tells you when the phone is straight'],
            ['Preserve Settings', 'Remembers your choices (Exposure, Styles, Live, Night mode) instead of resetting them'],
            ['Formats', 'HEIF or Most Compatible (JPEG); turn on ProRAW & Resolution Control'],
            ['Photographic Styles', 'Choose your default look'],
            ['Macro Control', 'Lets you switch macro off when the iPhone jumps to the Ultra Wide'],
            ['Prioritize Faster Shooting', 'Takes more photos quickly when you tap fast'],
            ['Camera Control', 'Sets what the side button does'],
          ]}
        />
        <P>
          The <b>Camera Control</b> button on the side opens the camera with a click and takes the photo with another.
          A light press shows its overlay; slide your finger along it to change zoom or exposure. A light double
          press lists the other controls it can adjust (Exposure, Depth, Zoom, Cameras, Styles, Tone).
        </P>
      </Section>

      <Section id="words" kicker="Practice" title="Words">
        <dl className="my-4 space-y-3 text-sm">
          {[
            ['Stop', 'Double or half the light. Every exposure setting moves in stops.'],
            ['Exposure', 'How much light the photo collected; how bright it is.'],
            ['Aperture / ƒ-number', 'The size of the opening in the lens. Smaller number, bigger opening.'],
            ['Shutter speed', 'How long the sensor collects light.'],
            ['ISO', 'How much the signal is amplified. Higher is brighter and grainier.'],
            ['Depth of field', 'How much of the scene, near to far, looks sharp.'],
            ['Bokeh', 'The quality of the out-of-focus blur.'],
            ['Noise / grain', 'Speckles from too little light being amplified.'],
            ['Clipping', 'Parts of the picture pushed to pure white or pure black, with no detail left.'],
            ['Metering', 'How the camera measures the light to choose its settings.'],
            ['White balance', 'Correcting for the colour of the light.'],
            ['Focal length', 'How wide or narrow a lens sees, in mm.'],
            ['HDR', 'Merging several exposures so bright skies and dark shadows both keep detail.'],
            ['RAW', 'A file that keeps what the sensor recorded, for editing.'],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-medium text-neutral-900 dark:text-neutral-100">{t}</dt>
              <dd className="text-neutral-600 dark:text-neutral-400">{d}</dd>
            </div>
          ))}
        </dl>
        <P>Now go outside and take a hundred photos. That’s the real course.</P>
      </Section>
    </article>
  )
}
