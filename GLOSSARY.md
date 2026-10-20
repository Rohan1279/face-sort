# Glossary

**Photo**: an image the user added. Referenced by its index in the order the photos were added.

**Face**: one detected face in a photo: its embedding, thumbnail, box and the photo it came from. A photo can hold several faces.

**Person**: a group of faces judged to be the same individual, plus the unique photos those faces come from. A group photo belongs to every person in it.

**Unsorted**: photos with no usable face, either because none was found or because the photo couldn't be read.

**Failed**: photos the engine couldn't read (for example a format the browser can't decode). Failed photos are also Unsorted.

**Engine**: the module that turns a photo into faces, loaded for one recognition model and carrying that model's grouping settings. The real engine runs Human (detection and landmarks) plus the recognition model in the browser; tests use a fake engine.

**Recognition model**: the ArcFace-family model that turns an aligned face into an embedding: SFace (default) or MBF. Each comes with its own grouping settings.

**Group fit**: a face's mean similarity to the other faces of its person. Low group fit usually means a hard photo (angle, lighting, blur), not a wrong person.

**Margin**: group fit minus the face's mean similarity to the closest other person. A small margin means the face could belong to that other person.
