import sys
import json
import base64
import tempfile
import os

from paddleocr import PaddleOCR


def main():
    ocr = None

    # Simple stdin line reading with BOM handling
    for raw_line in sys.stdin:
        line = raw_line.strip().lstrip('\ufeff')
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({'status': 'error', 'message': f'Invalid JSON: {e}'}) + '\n')
            sys.stdout.flush()
            continue

        action = msg.get('action', '')

        if action == 'init':
            try:
                lang = msg.get('lang', 'en')
                ocr = PaddleOCR(lang=lang, use_angle_cls=False, show_log=False)
                sys.stdout.write(json.dumps({'status': 'ok'}) + '\n')
                sys.stdout.flush()
            except Exception as e:
                sys.stdout.write(json.dumps({'status': 'error', 'message': str(e)}) + '\n')
                sys.stdout.flush()

        elif action == 'recognize':
            if ocr is None:
                sys.stdout.write(json.dumps({'status': 'error', 'message': 'Not initialized'}) + '\n')
                sys.stdout.flush()
                continue

            images = msg.get('images', [])
            results = []

            for img_source in images:
                try:
                    if os.path.isfile(img_source):
                        result = ocr.ocr(img_source, cls=False)
                    else:
                        try:
                            img_data = base64.b64decode(img_source)
                            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
                            tmp.write(img_data)
                            tmp_path = tmp.name
                            tmp.close()
                            result = ocr.ocr(tmp_path, cls=False)
                            os.unlink(tmp_path)
                        except Exception:
                            result = ocr.ocr(img_source, cls=False)

                    texts = []
                    if result and isinstance(result, list) and len(result) > 0 and result[0]:
                        for block in result[0]:
                            if isinstance(block, (list, tuple)) and len(block) == 2:
                                text_info = block[1]
                                if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                                    texts.append({
                                        'text': str(text_info[0]),
                                        'confidence': float(text_info[1])
                                    })
                    results.append(texts)
                except Exception as e:
                    results.append([{'text': '', 'confidence': 0.0}])

            sys.stdout.write(json.dumps({'status': 'ok', 'results': results}) + '\n')
            sys.stdout.flush()

        elif action == 'shutdown':
            sys.stdout.write(json.dumps({'status': 'ok'}) + '\n')
            sys.stdout.flush()
            break

        else:
            sys.stdout.write(json.dumps({'status': 'error', 'message': f'Unknown: {action}'}) + '\n')
            sys.stdout.flush()


if __name__ == '__main__':
    main()
